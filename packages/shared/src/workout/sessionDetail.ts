import type { OutboxItem } from './outbox.ts';
import { volumeKg } from './session.ts';
import type { SetRecord } from '../progress/lifts.ts';

// History → one workout: its sets as stored, corrected sets, and what the corrected data means for records.
// Pure, so the rules are unit-tested; the screen only shows what these return.

/** A `set_logs` row, in the app's own words. */
export interface SessionSet {
  id: string;
  exerciseId: string;
  slug: string;
  name: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  loggedAt: string;
}

export interface SessionInfo {
  id: string;
  dayName: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** 1 to 5, given after the workout. */
  rating: number | null;
}

export interface SessionExercise {
  slug: string;
  name: string;
  sets: { id: string; number: number; weightKg: number; reps: number; rpe: number | null }[];
}

export interface SessionDetail {
  id: string;
  title: string | null;
  startedAt: string;
  /** Whole minutes (at least 1); `null` while the workout is not finished. */
  minutes: number | null;
  exercises: SessionExercise[];
  totalSets: number;
  /** Sum of weight x reps, rounded to whole kg. */
  volume: number;
  rating: number | null;
}

const whole = (v: number | null) => (v === null || !Number.isFinite(Number(v)) ? 0 : Number(v));

/** Group a workout's sets by exercise (in the order they were first done), each exercise's sets in order. */
export function buildSessionDetail(session: SessionInfo, sets: readonly SessionSet[]): SessionDetail {
  const ordered = [...sets].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt) || a.setIndex - b.setIndex);
  const byExercise = new Map<string, SessionExercise>();
  for (const s of ordered) {
    const entry = byExercise.get(s.slug) ?? { slug: s.slug, name: s.name, sets: [] };
    entry.sets.push({ id: s.id, number: entry.sets.length + 1, weightKg: whole(s.weightKg), reps: whole(s.reps), rpe: s.rpe === null ? null : Number(s.rpe) });
    byExercise.set(s.slug, entry);
  }
  const minutes = session.finishedAt ? Math.max(1, Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60000)) : null;
  return {
    id: session.id,
    title: session.dayName,
    startedAt: session.startedAt,
    minutes,
    exercises: [...byExercise.values()],
    totalSets: ordered.length,
    volume: Math.round(volumeKg(ordered.map((s) => ({ slug: s.slug, weightKg: whole(s.weightKg), reps: whole(s.reps) })))),
    rating: session.rating,
  };
}

/** What may be typed when correcting a set. A typo like 1000 kg for 100 kg is refused. */
export const SET_EDIT_LIMITS = { weightKg: { min: 0, max: 500 }, reps: { min: 1, max: 100 }, rpe: { min: 1, max: 10 } } as const;

export interface SetEdit {
  weightKg: number;
  reps: number;
  rpe: number | null;
}

export type SetEditError = 'weight' | 'reps' | 'rpe';

export function validateSetEdit(e: SetEdit): SetEditError[] {
  const errors: SetEditError[] = [];
  const L = SET_EDIT_LIMITS;
  if (!Number.isFinite(e.weightKg) || e.weightKg < L.weightKg.min || e.weightKg > L.weightKg.max) errors.push('weight');
  if (!Number.isInteger(e.reps) || e.reps < L.reps.min || e.reps > L.reps.max) errors.push('reps');
  if (e.rpe !== null && (!Number.isFinite(e.rpe) || e.rpe < L.rpe.min || e.rpe > L.rpe.max)) errors.push('rpe');
  return errors;
}

/** The queued write for a corrected set: the full row again (same id), so sending it twice is harmless. */
export function setEditItem(userId: string, sessionId: string, set: SessionSet, edit: SetEdit): OutboxItem {
  return {
    id: set.id,
    table: 'set_logs',
    row: { id: set.id, user_id: userId, session_id: sessionId, exercise_id: set.exerciseId, set_index: set.setIndex, reps: edit.reps, weight_kg: edit.weightKg, rpe: edit.rpe, logged_at: set.loggedAt },
  };
}

export const setDeleteItem = (setId: string): OutboxItem => ({ id: setId, table: 'set_logs', row: {}, op: 'delete' });
export const sessionDeleteItem = (sessionId: string): OutboxItem => ({ id: sessionId, table: 'workout_sessions', row: {}, op: 'delete' });

/**
 * Show a workout as it will be once what is still queued has been sent: queued corrections replace the stored sets,
 * queued deletes remove them. So an edit made offline shows at once.
 */
export function applyQueuedEdits(sets: readonly SessionSet[], sessionId: string, queue: readonly OutboxItem[]): SessionSet[] {
  let out = [...sets];
  for (const item of queue) {
    if (item.table !== 'set_logs') continue;
    if (item.op === 'delete') {
      out = out.filter((s) => s.id !== item.id);
    } else if (item.row.session_id === sessionId) {
      out = out.map((s) => (s.id === item.id ? { ...s, reps: Number(item.row.reps), weightKg: Number(item.row.weight_kg), rpe: item.row.rpe === null || item.row.rpe === undefined ? null : Number(item.row.rpe) } : s));
    }
  }
  return out;
}

/** True when a queued delete removes the whole workout. */
export const sessionIsDeleted = (sessionId: string, queue: readonly OutboxItem[]): boolean =>
  queue.some((i) => i.table === 'workout_sessions' && i.op === 'delete' && i.id === sessionId);

/** A workout's sets as the records Progress works from (personal records, charts), so they can be recalculated after a correction. */
export function toSetRecords(sets: readonly SessionSet[]): SetRecord[] {
  return sets.filter((s) => whole(s.reps) > 0).map((s) => ({ slug: s.slug, name: s.name, weightKg: whole(s.weightKg), reps: whole(s.reps), loggedAt: s.loggedAt }));
}
