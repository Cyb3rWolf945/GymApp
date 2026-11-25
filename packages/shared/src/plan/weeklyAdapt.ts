import { type EntitlementRow, hasAccess } from '../payments/entitlements.ts';
import { MONTHLY_GENERATION_QUOTA } from '../payments/gating.ts';
import { tierIncludes } from '../payments/pricing.ts';

// E-54: who gets an automatic weekly plan update. Pure rules, used by the `weekly-adapt` Edge Function.

const day = 86_400_000;

/** The Monday (UTC) of the week of `now`, `YYYY-MM-DD`: one run per user per this week. */
export function adaptWeek(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * day).toISOString().slice(0, 10);
}

export type AdaptSkip = 'no_access' | 'opted_out' | 'already_ran' | 'quota';

export interface AdaptCandidate {
  ent: Pick<EntitlementRow, 'tier' | 'status' | 'current_period_end' | 'past_due_since'> | null;
  /** profiles.weekly_adapt (default true). */
  enabled: boolean;
  /** Non-failed generation jobs of this user since the start of the month (all kinds). */
  jobsThisMonth: number;
  /** A non-failed weekly job already exists for this week. */
  ranThisWeek: boolean;
}

/** Plans per run: a workout and a nutrition plan. */
export const JOBS_PER_ADAPT = 2;

export function adaptEligibility(c: AdaptCandidate, now = new Date()): { run: true } | { run: false; reason: AdaptSkip } {
  const e = c.ent;
  if (!e || !hasAccess(e, 'weekly_adjust', now) || e.tier === 'none' || !tierIncludes(e.tier, 'weekly_adjust')) return { run: false, reason: 'no_access' };
  if (!c.enabled) return { run: false, reason: 'opted_out' };
  if (c.ranThisWeek) return { run: false, reason: 'already_ran' };
  if (c.jobsThisMonth + JOBS_PER_ADAPT > MONTHLY_GENERATION_QUOTA[e.tier]) return { run: false, reason: 'quota' };
  return { run: true };
}
