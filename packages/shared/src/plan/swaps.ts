import type { WorkoutPlan } from '../ai/schemas.ts';

export interface SwapRow {
  day_index: number;
  from_slug: string;
  to_slug: string;
  created_at: string;
}

/**
 * Apply the user's swaps on top of the generated plan, oldest first. A swap only applies if its
 * `from_slug` is still in that day, so chains (A → B, then B → C) work and stale rows are ignored.
 */
export function applySwaps(plan: WorkoutPlan, swaps: readonly SwapRow[]): WorkoutPlan {
  const days = plan.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
  const ordered = [...swaps].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const s of ordered) {
    const day = days[s.day_index];
    const ex = day?.exercises.find((e) => e.exerciseSlug === s.from_slug);
    if (ex) ex.exerciseSlug = s.to_slug;
  }
  return { ...plan, days };
}

/** An exercise swapped out at least this many times is a pattern, not a one-off. */
export const SWAP_SIGNAL_THRESHOLD = 2;

/** Slugs the user keeps swapping out ("always swaps lunges"), most swapped first. */
export function swapSignals(swaps: readonly Pick<SwapRow, 'from_slug'>[], threshold = SWAP_SIGNAL_THRESHOLD): string[] {
  const counts = new Map<string, number>();
  for (const s of swaps) counts.set(s.from_slug, (counts.get(s.from_slug) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug]) => slug);
}
