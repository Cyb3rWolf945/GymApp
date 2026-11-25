// Edge Function: weekly-adapt. Run once a week (pg_cron -> run_weekly_adapt()) with the service-role key as bearer token.
// For each eligible user (Elite entitlement, not opted out, quota left, not run this week) it starts the normal
// "Update my plan" pipeline through generate-plan (source 'weekly'): Planner -> validator -> QA -> guardrails, logged as AI calls.
// generate-plan applies tier and quota again and marks the jobs `adapt_state = 'new'`; failures never touch the current plan.
import { createClient } from '@supabase/supabase-js';
import { adaptEligibility, adaptWeek, type AdaptSkip } from '../../../packages/shared/src/plan/weeklyAdapt.ts';
import { startOfMonthUtc } from '../../../packages/shared/src/payments/gating.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const MAX_USERS_PER_RUN = 200;

Deno.serve(async (req) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${key}`) return json(401, { error: 'Not allowed.' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, key); // server only
  const now = new Date();
  const week = adaptWeek(now);

  // Only Elite entitlements can qualify; the rest of the rules are in adaptEligibility.
  const { data: ents, error } = await admin.from('entitlements').select('user_id,tier,status,current_period_end,past_due_since').eq('tier', 'elite').limit(MAX_USERS_PER_RUN);
  if (error) return json(500, { error: 'Could not load users.' });
  const ids = (ents ?? []).map((e: { user_id: string }) => e.user_id);
  if (ids.length === 0) return json(200, { ok: true, week, started: 0, skipped: {} });

  const [{ data: profiles }, { data: month }, { data: weekly }] = await Promise.all([
    admin.from('profiles').select('user_id,weekly_adapt').in('user_id', ids),
    admin.from('generation_jobs').select('user_id').in('user_id', ids).neq('status', 'failed').gte('created_at', startOfMonthUtc(now)),
    admin.from('generation_jobs').select('user_id').in('user_id', ids).neq('status', 'failed').eq('adapt_week', week),
  ]);
  const optIn = new Map(((profiles ?? []) as { user_id: string; weekly_adapt: boolean }[]).map((p) => [p.user_id, p.weekly_adapt]));
  const count = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const monthN = count(month);
  const weekN = count(weekly);

  const skipped: Partial<Record<AdaptSkip | 'no_profile' | 'error', number>> = {};
  const skip = (r: AdaptSkip | 'no_profile' | 'error') => (skipped[r] = (skipped[r] ?? 0) + 1);
  let started = 0;
  for (const e of ents as { user_id: string; tier: 'elite'; status: string; current_period_end: string | null; past_due_since: string | null }[]) {
    if (!optIn.has(e.user_id)) {
      skip('no_profile');
      continue;
    }
    const d = adaptEligibility({ ent: e as never, enabled: optIn.get(e.user_id) !== false, jobsThisMonth: monthN.get(e.user_id) ?? 0, ranThisWeek: (weekN.get(e.user_id) ?? 0) > 0 }, now);
    if (!d.run) {
      skip(d.reason);
      continue;
    }
    try {
      // Sequential: the two plans of a user, then the next user. A failure only skips this user.
      for (const kind of ['workout_plan', 'nutrition_plan'] as const) {
        const res = await fetch(`${url}/functions/v1/generate-plan`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, userId: e.user_id, source: 'weekly', update: true }),
        });
        if (!res.ok) throw new Error('generate-plan refused');
      }
      started += 1;
    } catch {
      skip('error');
    }
  }
  return json(200, { ok: true, week, started, skipped });
});
