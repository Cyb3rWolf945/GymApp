import { useCallback, useEffect, useState } from 'react';
import { type ExplainedChange, type GenerationProgress, type JobRow, POLL_INTERVAL_MS, type UpdateSummary, deriveProgress } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { notifyPlanChanged } from '../home/planVersion';
import { START_KINDS, fetchJobs, startPlanUpdate } from './api';

export type UpdateView =
  | { kind: 'starting' }
  | { kind: 'running'; progress: GenerationProgress }
  | { kind: 'done'; note: string | null; workout: ExplainedChange[]; meals: ExplainedChange[] }
  | { kind: 'needs_upgrade' }
  | { kind: 'error'; reason: 'generate' | 'timeout' };

const summaryOf = (row: JobRow | undefined): UpdateSummary | null => {
  const u = (row?.result as { update?: UpdateSummary | null } | null | undefined)?.update;
  return u && Array.isArray(u.changes) ? u : null;
};

/** Starts "Update my plan" for both plan kinds and follows those two jobs until they are done. */
export function useUpdatePlan(): { view: UpdateView; retry: () => void } {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [view, setView] = useState<UpdateView>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setView({ kind: 'starting' });

    void (async () => {
      const ids: string[] = [];
      for (const kind of START_KINDS) {
        const r = await startPlanUpdate(kind);
        if (!active) return;
        if (r.result === 'needs_upgrade') return setView({ kind: 'needs_upgrade' });
        if (r.result === 'error') return setView({ kind: 'error', reason: 'generate' });
        ids.push(r.jobId);
      }
      const poll = async () => {
        let rows: JobRow[];
        try {
          rows = (await fetchJobs(userId)).filter((r) => ids.includes(r.id));
        } catch {
          return active && setView({ kind: 'error', reason: 'generate' });
        }
        if (!active) return;
        const progress = deriveProgress(rows, startedAt, Date.now());
        if (progress.phase === 'failed') return setView({ kind: 'error', reason: 'generate' });
        if (progress.phase === 'timeout') return setView({ kind: 'error', reason: 'timeout' });
        if (progress.phase === 'done') {
          const w = summaryOf(rows.find((r) => r.kind === 'workout_plan'));
          const m = summaryOf(rows.find((r) => r.kind === 'nutrition_plan'));
          notifyPlanChanged();
          return setView({ kind: 'done', note: m?.note ?? w?.note ?? null, workout: w?.changes ?? [], meals: m?.changes ?? [] });
        }
        setView({ kind: 'running', progress });
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      };
      void poll();
    })();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { view, retry };
}
