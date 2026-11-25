import { useEffect, useState } from 'react';
import type { ExplainedChange, JobRow, UpdateSummary } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabase';
import { notifyPlanChanged } from '../home/planVersion';

// E-54: the weekly adaptation. The new plan is already active; the user keeps it or goes back to last week's.

export interface WeeklyChanges {
  week: string;
  note: string | null;
  workout: ExplainedChange[];
  meals: ExplainedChange[];
}

const summaryOf = (row: JobRow | undefined): UpdateSummary | null => {
  const u = (row?.result as { update?: UpdateSummary | null } | null | undefined)?.update;
  return u && Array.isArray(u.changes) ? u : null;
};

/** The weekly plan the user has not decided on yet (own rows, RLS), or null. */
export async function fetchPendingWeekly(userId: string): Promise<WeeklyChanges | null> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('id,kind,status,created_at,result,adapt_state,adapt_week')
    .eq('user_id', userId)
    .eq('adapt_state', 'new')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(2);
  if (error) throw error;
  // Own pending weekly jobs only (the query already filters; this keeps the pair of one week together).
  const rows = ((data ?? []) as unknown as JobRow[]).filter((r) => r.adapt_state === 'new' && r.adapt_week);
  const week = rows[0]?.adapt_week;
  if (!week) return null;
  const w = summaryOf(rows.find((r) => r.kind === 'workout_plan' && r.adapt_week === week));
  const m = summaryOf(rows.find((r) => r.kind === 'nutrition_plan' && r.adapt_week === week));
  return { week, note: m?.note ?? w?.note ?? null, workout: w?.changes ?? [], meals: m?.changes ?? [] };
}

/** "Keep new plan" (true) or "Go back to last week" (false). */
export async function resolveWeekly(week: string, keep: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('resolve_weekly_adapt', { p_week: week, p_keep: keep } as never);
  if (error) return false;
  notifyPlanChanged(); // the plan screens reload: the reverted plan is skipped
  listeners.forEach((fn) => fn());
  return true;
}

const listeners = new Set<() => void>();

/** The pending weekly plan for Today's card; refreshes after a decision. */
export function usePendingWeekly(): WeeklyChanges | null {
  const { user } = useAuth();
  const [pending, setPending] = useState<WeeklyChanges | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const read = () => void fetchPendingWeekly(user.id).then((v) => active && setPending(v)).catch(() => active && setPending(null));
    read();
    listeners.add(read);
    return () => {
      active = false;
      listeners.delete(read);
    };
  }, [user]);
  return pending;
}

/** The "Adapt my plan every week" switch (profiles.weekly_adapt, default on). */
export function useWeeklyAdaptSetting() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from('profiles')
      .select('weekly_adapt')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => active && setEnabled((data as { weekly_adapt?: boolean } | null)?.weekly_adapt !== false));
    return () => {
      active = false;
    };
  }, [user]);
  const toggle = async () => {
    if (!user || enabled === null) return;
    setBusy(true);
    setError(false);
    const next = !enabled;
    const { error: e } = await supabase.from('profiles').update({ weekly_adapt: next } as never).eq('user_id', user.id);
    setBusy(false);
    if (e) return setError(true);
    setEnabled(next);
  };
  return { enabled, busy, error, toggle };
}
