export interface PriorJob {
  status: string;
}

export const FREE_GENERATIONS = 1;

export type GenerateDecision =
  | { allow: true }
  | { allow: false; reason: 'needs_trial' };

/**
 * Who may start a generation (checked server-side).
 * - Entitled users: always.
 * - Everyone else: one free generation per plan kind, so the plan preview can be shown before the paywall.
 *   Failed jobs do not count, so a failure never locks the user out.
 */
export function canGenerate(entitled: boolean, priorJobsOfKind: readonly PriorJob[]): GenerateDecision {
  if (entitled) return { allow: true };
  const used = priorJobsOfKind.filter((j) => j.status !== 'failed').length;
  return used < FREE_GENERATIONS ? { allow: true } : { allow: false, reason: 'needs_trial' };
}

export const isEntitled = (e: { tier: string; status: string } | null | undefined): boolean =>
  !!e && e.tier !== 'none' && ['active', 'trialing'].includes(e.status);
