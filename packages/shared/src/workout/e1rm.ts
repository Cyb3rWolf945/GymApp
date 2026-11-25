// Estimated one-rep max (Epley) and PR detection.

/** Epley: weight × (1 + reps / 30). One rep is the weight itself. Returns 0 for empty sets. */
export function epley(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface LoggedSet {
  /** Catalog slug of the exercise. */
  slug: string;
  weightKg: number;
  reps: number;
  rpe?: number;
  /** A warm-up set (E-56): never counts for PRs, volume or the set count of the plan. */
  warmup?: boolean;
}

export interface NewPR {
  slug: string;
  /** Best e1RM of this workout, kg (1 decimal). */
  e1rm: number;
  /** Best e1RM before this workout, kg. 0 = first time. */
  previous: number;
  /** The set that set the record. */
  weightKg: number;
  reps: number;
}

/**
 * Exercises where this workout beat the previous best e1RM.
 * A first-ever result is not a PR (there is nothing to beat); it just becomes the baseline.
 */
export function detectPRs(sets: readonly LoggedSet[], previousBest: ReadonlyMap<string, number>): NewPR[] {
  const best = new Map<string, NewPR>();
  for (const s of sets) {
    if (s.warmup) continue;
    const e = epley(s.weightKg, s.reps);
    if (e <= 0) continue;
    const cur = best.get(s.slug);
    if (!cur || e > cur.e1rm) best.set(s.slug, { slug: s.slug, e1rm: e, previous: previousBest.get(s.slug) ?? 0, weightKg: s.weightKg, reps: s.reps });
  }
  return [...best.values()]
    .filter((p) => p.previous > 0 && p.e1rm > p.previous + 1e-9)
    .map((p) => ({ ...p, e1rm: round1(p.e1rm), previous: round1(p.previous) }));
}
