import { MUSCLE_IDS, type MuscleId } from '../catalog/catalog.ts';

// Muscle map data: weekly effective sets per muscle (heatmap) and the detail shown when a muscle is tapped.

export const PRIMARY_WEIGHT = 1;
export const SECONDARY_WEIGHT = 0.5;
export const WINDOW_DAYS = 7;
export const MONTH_DAYS = 30;

export interface MuscleSet {
  slug: string;
  name: string;
  /** ISO timestamp. */
  loggedAt: string;
  /** Muscles the exercise works (catalog `exercise_muscles`). */
  muscles: { muscle: string; role: 'primary' | 'secondary' }[];
}

export interface MuscleStat {
  muscle: MuscleId;
  /** Effective sets in the window: primary 1, secondary 0.5 (1 decimal). */
  sets: number;
  /** Date of the most recent set that worked it (any time, YYYY-MM-DD), or null. */
  lastTrained: string | null;
  /** Exercises that contributed most in the window, by effective sets. */
  topExercises: { slug: string; name: string; sets: number }[];
}

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const isMuscle = (m: string): m is MuscleId => (MUSCLE_IDS as readonly string[]).includes(m);

/**
 * Per muscle stats. `sets` and `topExercises` use the last `windowDays` days, as sets PER WEEK (a 30-day window is a weekly
 * average, so the same bands apply); `lastTrained` looks at everything passed in.
 */
export function muscleStats(sets: readonly MuscleSet[], now = new Date(), windowDays = WINDOW_DAYS): Map<MuscleId, MuscleStat> {
  const since = now.getTime() - windowDays * DAY;
  const perWeek = 7 / windowDays;
  const acc = new Map<MuscleId, { sets: number; last: string | null; byExercise: Map<string, { name: string; sets: number }> }>();
  for (const s of sets) {
    const at = Date.parse(s.loggedAt);
    if (!Number.isFinite(at) || at > now.getTime()) continue;
    for (const m of s.muscles) {
      if (!isMuscle(m.muscle)) continue;
      const a = acc.get(m.muscle) ?? { sets: 0, last: null, byExercise: new Map() };
      if (!a.last || s.loggedAt > a.last) a.last = s.loggedAt;
      if (at > since) {
        const w = m.role === 'primary' ? PRIMARY_WEIGHT : SECONDARY_WEIGHT;
        a.sets += w;
        const ex = a.byExercise.get(s.slug) ?? { name: s.name, sets: 0 };
        ex.sets += w;
        a.byExercise.set(s.slug, ex);
      }
      acc.set(m.muscle, a);
    }
  }
  const out = new Map<MuscleId, MuscleStat>();
  for (const id of MUSCLE_IDS) {
    const a = acc.get(id);
    out.set(id, {
      muscle: id,
      sets: round1((a?.sets ?? 0) * perWeek),
      lastTrained: a?.last ? a.last.slice(0, 10) : null,
      topExercises: [...(a?.byExercise.entries() ?? [])]
        .map(([slug, e]) => ({ slug, name: e.name, sets: round1(e.sets * perWeek) }))
        .sort((x, y) => y.sets - x.sets || x.name.localeCompare(y.name))
        .slice(0, 3),
    });
  }
  return out;
}

/** Weekly effective sets per muscle, in bands: 0, 1-4, 5-9, 10-20, more than 20. */
export const HEAT_LEVEL_LABELS = ['0', '1–4', '5–9', '10–20', '20+'] as const;
export type HeatLevel = 0 | 1 | 2 | 3 | 4;
export const heatLevel = (sets: number): HeatLevel => (sets <= 0 ? 0 : sets < 5 ? 1 : sets < 10 ? 2 : sets <= 20 ? 3 : 4);
/** Brightness of each level (0 = the base body tone, 1 = the hottest). Ordered, so it reads in greyscale too. */
export const HEAT_INTENSITY: readonly number[] = [0, 0.3, 0.55, 0.8, 1];
/** 0 (not trained) to 1 (very high volume): the heatmap intensity. */
export const heat = (sets: number): number => HEAT_INTENSITY[heatLevel(sets)];

/** "latissimus_dorsi" -> "Latissimus dorsi". */
export const muscleLabel = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
