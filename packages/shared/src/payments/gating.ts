import type { PlanKind } from '../ai/schemas.ts';
import { FREE_GENERATIONS, type PriorJob } from '../plan/access.ts';
import { type EntitlementRow, hasAccess } from './entitlements.ts';
import { type Feature, type Tier, tierIncludes } from './pricing.ts';

// Feature matrix (SPEC §6). Enforced server-side: `has_access(user, feature)` in SQL, the generate-plan function,
// and RLS on the tables that Pro features write. Keep `FEATURE_MIN_TIER` and the SQL `has_access` in sync.

/** Generations per calendar month. Basic: 1 (workouts only). Pro/Elite: a fair-use cap that protects LLM cost. */
export const MONTHLY_GENERATION_QUOTA: Record<Exclude<Tier, 'none'>, number> = { basic: 1, pro: 30, elite: 60 };

export type GenerationDecision =
  | { allow: true }
  | { allow: false; reason: 'needs_trial' | 'upgrade' | 'quota' };

type Ent = Pick<EntitlementRow, 'tier' | 'status' | 'current_period_end' | 'past_due_since'>;

/**
 * Who may start a generation.
 * - No active entitlement: one free generation per kind (the plan preview before the paywall).
 * - Basic: workouts only, 1 per month. Nutrition needs Pro.
 * - Pro/Elite: up to the monthly fair-use cap.
 * `jobsOfKind` are this user's jobs of that kind; `jobsThisMonth` all their jobs since the start of the month.
 * Failed jobs never count.
 */
export function decideGeneration(
  ent: Ent | null | undefined,
  kind: PlanKind,
  jobsOfKind: readonly PriorJob[],
  jobsThisMonth: readonly PriorJob[],
  now = new Date(),
): GenerationDecision {
  const used = (jobs: readonly PriorJob[]) => jobs.filter((j) => j.status !== 'failed').length;
  if (!ent || !hasAccess(ent, 'basic', now)) {
    return used(jobsOfKind) < FREE_GENERATIONS ? { allow: true } : { allow: false, reason: 'needs_trial' };
  }
  const feature: Feature = kind === 'nutrition_plan' ? 'nutrition' : 'workouts';
  if (!tierIncludes(ent.tier, feature)) return { allow: false, reason: 'upgrade' };
  const quota = MONTHLY_GENERATION_QUOTA[ent.tier as Exclude<Tier, 'none'>];
  return used(jobsThisMonth) < quota ? { allow: true } : { allow: false, reason: 'quota' };
}

export const startOfMonthUtc = (now = new Date()): string => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
