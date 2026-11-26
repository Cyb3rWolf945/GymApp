import { epley, type LoggedSet } from './e1rm.ts';

// Pure logic of the workout session screen.

export interface PlannedExercise {
  slug: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface Position {
  /** Index into the planned exercises. */
  exercise: number;
  /** 0-based set number inside the exercise. */
  set: number;
}

/** Where the next set goes: the first exercise that still has planned sets left. null = everything is logged. */
export function nextPosition(planned: readonly PlannedExercise[], logged: readonly LoggedSet[]): Position | null {
  const done = new Map<string, number>();
  for (const s of logged) if (!s.warmup) done.set(s.slug, (done.get(s.slug) ?? 0) + 1);
  for (let i = 0; i < planned.length; i++) {
    const n = done.get(planned[i].slug) ?? 0;
    if (n < planned[i].sets) return { exercise: i, set: n };
  }
  return null;
}

export interface Prefill {
  weightKg: number;
  reps: number;
}

/**
 * Start values for a set, so a normal set is one tap: the previous set of this exercise in this workout,
 * else the best set of the last workout, else 0 kg at the top of the rep range.
 */
export function prefillSet(
  planned: PlannedExercise,
  loggedThisWorkout: readonly LoggedSet[],
  lastWorkout: Prefill | undefined,
): Prefill {
  const prev = [...loggedThisWorkout].reverse().find((s) => s.slug === planned.slug && !s.warmup);
  if (prev) return { weightKg: prev.weightKg, reps: prev.reps };
  if (lastWorkout) return lastWorkout;
  return { weightKg: 0, reps: planned.repsMax };
}

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** "1:30" */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The share of the rest still to go, from 1 (just started) to 0 (done). Never outside that range, 0 for a zero-length rest. */
export function restFraction(left: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, left / total));
}

/** "Set 3 of 4 · 80 kg × 8" */
export function setLine(setNumber: number, total: number, weightKg: number, reps: number): string {
  const load = weightKg > 0 ? `${trim(weightKg)} kg × ${reps}` : `${reps} reps`;
  return `Set ${setNumber} of ${total} · ${load}`;
}

/** Total volume (weight × reps) of a list of sets, in kg. */
export const volumeKg = (sets: readonly LoggedSet[]): number => sets.reduce((t, s) => (s.warmup ? t : t + s.weightKg * s.reps), 0);

export interface HistoryRow {
  exercise_id: string;
  weight_kg: number | null;
  reps: number | null;
  session_id: string;
  logged_at: string;
}

export interface HistorySummary {
  /** Per exercise id: the best set of the most recent workout (what to pre-fill). */
  last: Map<string, Prefill>;
  /** Per exercise id: best e1RM ever logged (what a PR must beat). */
  best: Map<string, number>;
}

export function summarizeHistory(rows: readonly HistoryRow[]): HistorySummary {
  const last = new Map<string, Prefill>();
  const lastSession = new Map<string, { session: string; at: string; e: number }>();
  const best = new Map<string, number>();
  for (const r of rows) {
    const w = Number(r.weight_kg ?? 0);
    const reps = Number(r.reps ?? 0);
    const e = epley(w, reps);
    if (e > (best.get(r.exercise_id) ?? 0)) best.set(r.exercise_id, e);
    const cur = lastSession.get(r.exercise_id);
    if (!cur || r.logged_at > cur.at) {
      lastSession.set(r.exercise_id, { session: r.session_id, at: r.logged_at, e });
      last.set(r.exercise_id, { weightKg: w, reps });
    }
  }
  // Within the most recent workout, prefer its best set (highest e1RM).
  for (const [ex, ls] of lastSession) {
    let top = { e: -1, weightKg: 0, reps: 0 };
    for (const r of rows) {
      if (r.exercise_id !== ex || r.session_id !== ls.session) continue;
      const w = Number(r.weight_kg ?? 0);
      const reps = Number(r.reps ?? 0);
      const e = epley(w, reps);
      if (e > top.e) top = { e, weightKg: w, reps };
    }
    if (top.e >= 0) last.set(ex, { weightKg: top.weightKg, reps: top.reps });
  }
  return { last, best };
}
