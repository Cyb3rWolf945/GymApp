import { type MuscleId } from '../catalog/catalog.ts';
import { EXERCISE_LEVELS } from '../catalog/catalog.ts';
import { expandEquipment } from '../ai/generate.ts';
import { bodyRegions } from '../bodymap/index.ts';
import { type HeatLevel, type MuscleSet, PRIMARY_WEIGHT, SECONDARY_WEIGHT, heatLevel } from './muscles.ts';

// Everything the muscle detail sheet shows, worked out from the logged sets. Pure, so it is unit-tested.

export const TREND_WEEKS = 8;
/** A general guideline for muscle growth, in effective sets a week. Shown as a reference band, never as advice for one person. */
export const GROWTH_SETS_PER_WEEK = { min: 10, max: 20 } as const;
/** How many top exercises the sheet lists. */
export const TOP_EXERCISES = 5;
/** How many "train it next" suggestions the sheet shows. */
export const TRAIN_NEXT_COUNT = 3;

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** General guidance from days since the muscle was last trained. Not medical: a rule of thumb for planning. */
export type MuscleStatus = 'fresh' | 'ready' | 'recovering';
/** Trained today or in the last 2 days. */
export const RECOVERING_MAX_DAYS = 2;
/** 3 to 6 days ago. From 7 days (or never) it is fresh. */
export const READY_MAX_DAYS = 6;

export function muscleStatus(daysSince: number | null): MuscleStatus {
  if (daysSince === null) return 'fresh';
  if (daysSince <= RECOVERING_MAX_DAYS) return 'recovering';
  if (daysSince <= READY_MAX_DAYS) return 'ready';
  return 'fresh';
}

/** Whole calendar days (UTC) from `lastTrained` (YYYY-MM-DD) to `now`: 0 is today. `null` when never trained. */
export function daysSinceTrained(lastTrained: string | null, now: Date): number | null {
  if (!lastTrained) return null;
  const last = Date.parse(`${lastTrained.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(last)) return null;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((today - last) / DAY));
}

export interface MuscleDetailExercise {
  slug: string;
  name: string;
  /** Effective sets a week in the chosen period. */
  sets: number;
  /** Its share of this muscle's sets in the period, 0 to 1 (two decimals). All exercises together add up to 1. */
  share: number;
  /** Is this muscle the main one in the exercise, or does it only help? */
  role: 'primary' | 'secondary';
}

export interface MuscleDetail {
  muscle: MuscleId;
  period: 7 | 30;
  /** Effective sets a week over the period (a 30-day window is a weekly average): what the map's heat is drawn from. */
  sets: number;
  heat: HeatLevel;
  lastTrained: string | null;
  daysSince: number | null;
  status: MuscleStatus;
  /** Effective sets in each of the last `TREND_WEEKS` weeks, oldest first: the last one is the current week (the last 7 days). */
  weeks: { weeksAgo: number; sets: number }[];
  /** Any sets at all in those weeks. False shows the "not trained yet" state. */
  trained: boolean;
  topExercises: MuscleDetailExercise[];
}

/** The detail of one muscle: the heat level, how long since it was trained, 8 weeks of sets and the exercises that work it. */
export function muscleDetail(muscle: MuscleId, sets: readonly MuscleSet[], now = new Date(), period: 7 | 30 = 7): MuscleDetail {
  const nowMs = now.getTime();
  const windowStart = nowMs - period * DAY;
  const weekly = new Array<number>(TREND_WEEKS).fill(0);
  const byExercise = new Map<string, { name: string; sets: number; primary: boolean }>();
  let windowSets = 0;
  let last: string | null = null;
  for (const s of sets) {
    const at = Date.parse(s.loggedAt);
    if (!Number.isFinite(at) || at > nowMs) continue;
    const hit = s.muscles.find((m) => m.muscle === muscle);
    if (!hit) continue;
    const w = hit.role === 'primary' ? PRIMARY_WEIGHT : SECONDARY_WEIGHT;
    if (!last || s.loggedAt > last) last = s.loggedAt;
    const weeksAgo = Math.floor((nowMs - at) / WEEK);
    if (weeksAgo < TREND_WEEKS) weekly[weeksAgo] += w;
    if (at > windowStart) {
      windowSets += w;
      const ex = byExercise.get(s.slug) ?? { name: s.name, sets: 0, primary: false };
      ex.sets += w;
      if (hit.role === 'primary') ex.primary = true;
      byExercise.set(s.slug, ex);
    }
  }
  const perWeek = 7 / period;
  const setsPerWeek = round1(windowSets * perWeek);
  const lastTrained = last ? last.slice(0, 10) : null;
  const daysSince = daysSinceTrained(lastTrained, now);
  return {
    muscle,
    period,
    sets: setsPerWeek,
    heat: heatLevel(setsPerWeek),
    lastTrained,
    daysSince,
    status: muscleStatus(daysSince),
    weeks: weekly.map((v, weeksAgo) => ({ weeksAgo, sets: round1(v) })).reverse(),
    trained: weekly.some((v) => v > 0),
    topExercises: [...byExercise.entries()]
      .map(([slug, e]) => ({ slug, name: e.name, sets: round1(e.sets * perWeek), share: windowSets > 0 ? round2(e.sets / windowSets) : 0, role: e.primary ? ('primary' as const) : ('secondary' as const) }))
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name))
      .slice(0, TOP_EXERCISES),
  };
}

/** An exercise from the library, with what is needed to decide whether it suits someone. */
export interface LibraryExercise {
  slug: string;
  name: string;
  equipment: string | null;
  level: string | null;
  contraindications: readonly string[] | null;
  muscles: readonly { muscle: string; role: 'primary' | 'secondary' }[];
}

export interface TrainNextProfile {
  equipment: readonly string[];
  contraindications: readonly string[];
  level: string;
}

const levelRank = (level: string | null | undefined) => {
  const i = (EXERCISE_LEVELS as readonly string[]).indexOf(level ?? '');
  return i < 0 ? 0 : i;
};

/**
 * 2 or 3 exercises that work this muscle as their main one and suit the person: the equipment they have (bodyweight
 * always), no exercise that touches a declared injury area, nothing above their level. The same rules as the swap
 * suggestions, without a language model. Exercises not done lately come first (never done before long ago), then easier ones, then by name.
 * `lastDone` maps an exercise slug to the ISO time it was last logged.
 */
export function trainNextCandidates(
  muscle: MuscleId,
  library: readonly LibraryExercise[],
  profile: TrainNextProfile,
  lastDone: ReadonlyMap<string, string> = new Map(),
  limit = TRAIN_NEXT_COUNT,
): LibraryExercise[] {
  const equipment = new Set(expandEquipment([...profile.equipment]));
  const avoid = new Set(profile.contraindications);
  const maxLevel = levelRank(profile.level);
  return library
    .filter((e) => e.muscles.some((m) => m.muscle === muscle && m.role === 'primary'))
    .filter((e) => e.equipment !== null && (e.equipment === 'bodyweight' || equipment.has(e.equipment)))
    .filter((e) => !(e.contraindications ?? []).some((c) => avoid.has(c)))
    .filter((e) => levelRank(e.level) <= maxLevel)
    .sort((a, b) => {
      const da = lastDone.get(a.slug) ?? '';
      const db = lastDone.get(b.slug) ?? '';
      return da.localeCompare(db) || levelRank(a.level) - levelRank(b.level) || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

/** Muscles drawn on a view, top to bottom, each once: the order the previous and next arrows step through. */
export function muscleSequence(view: 'front' | 'back'): MuscleId[] {
  const seen = new Set<MuscleId>();
  for (const r of [...bodyRegions(view)].sort((a, b) => a.y - b.y)) seen.add(r.muscle as MuscleId);
  return [...seen];
}

/** The view to show this muscle on: `prefer` when it draws the muscle (many are drawn on both sides), else the front, else the back, or `null` when neither draws it (a deep muscle). */
export function muscleView(muscle: MuscleId, prefer?: 'front' | 'back'): 'front' | 'back' | null {
  const draws = (v: 'front' | 'back') => bodyRegions(v).some((r) => r.muscle === muscle);
  if (prefer && draws(prefer)) return prefer;
  if (draws('front')) return 'front';
  if (draws('back')) return 'back';
  return null;
}
