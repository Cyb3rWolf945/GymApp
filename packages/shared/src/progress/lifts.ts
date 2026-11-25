import { epley } from '../workout/e1rm.ts';

// PR list and e1RM trend per lift, from logged sets.

export interface SetRecord {
  slug: string;
  name: string;
  weightKg: number;
  reps: number;
  /** ISO timestamp. */
  loggedAt: string;
}

/** The four lifts that get a trend chart first. Anything else the user logs most is added after them. */
export const MAIN_LIFTS = ['barbell-bench-press', 'barbell-back-squat', 'conventional-deadlift', 'standing-barbell-overhead-press'] as const;

export interface PersonalRecord {
  slug: string;
  name: string;
  /** Best estimated 1-rep max, kg (1 decimal). */
  e1rm: number;
  weightKg: number;
  reps: number;
  /** YYYY-MM-DD of the set. */
  date: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const dateOf = (iso: string) => iso.slice(0, 10);

/** Best e1RM per exercise (the set that holds it), highest first. Sets with no weight or reps are ignored. */
export function personalRecords(sets: readonly SetRecord[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord & { raw: number }>();
  for (const s of sets) {
    const e = epley(s.weightKg, s.reps);
    if (e <= 0) continue;
    const cur = best.get(s.slug);
    // On a tie the earlier set keeps the record.
    if (!cur || e > cur.raw + 1e-9 || (Math.abs(e - cur.raw) <= 1e-9 && dateOf(s.loggedAt) < cur.date)) {
      best.set(s.slug, { slug: s.slug, name: s.name, e1rm: round1(e), raw: e, weightKg: s.weightKg, reps: s.reps, date: dateOf(s.loggedAt) });
    }
  }
  return [...best.values()].map((r) => ({ slug: r.slug, name: r.name, e1rm: r.e1rm, weightKg: r.weightKg, reps: r.reps, date: r.date })).sort((a, b) => b.e1rm - a.e1rm || a.name.localeCompare(b.name));
}

export interface TrendPoint {
  date: string;
  e1rm: number;
}

/** Best e1RM per day for one exercise, oldest first: the points of the trend chart. */
export function e1rmTrend(sets: readonly SetRecord[], slug: string): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const s of sets) {
    if (s.slug !== slug) continue;
    const e = epley(s.weightKg, s.reps);
    if (e <= 0) continue;
    const d = dateOf(s.loggedAt);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, e));
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, e]) => ({ date, e1rm: round1(e) }));
}

/**
 * Lifts to offer in the trend picker: the main lifts the user has logged, then their most-logged other exercises,
 * at most `limit`.
 */
export function trendLifts(sets: readonly SetRecord[], limit = 6): { slug: string; name: string }[] {
  const counts = new Map<string, { name: string; sets: number }>();
  for (const s of sets) {
    if (epley(s.weightKg, s.reps) <= 0) continue;
    const c = counts.get(s.slug) ?? { name: s.name, sets: 0 };
    c.sets += 1;
    counts.set(s.slug, c);
  }
  const main = MAIN_LIFTS.filter((m) => counts.has(m));
  const rest = [...counts.entries()]
    .filter(([slug]) => !(MAIN_LIFTS as readonly string[]).includes(slug))
    .sort((a, b) => b[1].sets - a[1].sets || a[1].name.localeCompare(b[1].name))
    .map(([slug]) => slug);
  return [...main, ...rest].slice(0, limit).map((slug) => ({ slug, name: counts.get(slug)!.name }));
}
