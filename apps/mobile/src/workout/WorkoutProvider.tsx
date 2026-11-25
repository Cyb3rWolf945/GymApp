import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NewPR, type OutboxItem, detectPRs, enqueue, flushOutbox, summarizeHistory, volumeKg, type HistoryRow,
} from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabase';
import { loadActive, loadOutbox, saveActive, saveOutbox } from './storage';
import type { ActiveSet, ActiveWorkout, PlannedWithId } from './types';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

export interface StartInput {
  dayName: string;
  exercises: { slug: string; name: string; sets: number; repsMin: number; repsMax: number; restSeconds: number }[];
}

export interface FinishResult {
  prs: NewPR[];
  sets: number;
  minutes: number;
  volume: number;
}

interface Ctx {
  active: ActiveWorkout | null;
  hydrated: boolean;
  /** Items still waiting to reach the server. */
  pending: number;
  /** The queued writes themselves (History shows corrections made offline before they are sent). */
  outbox: readonly OutboxItem[];
  /** Queue a write or delete and send it as soon as there is a connection (corrections made in History). */
  queue: (item: OutboxItem) => void;
  start: (input: StartInput) => Promise<void>;
  logSet: (set: { slug: string; weightKg: number; reps: number; rpe?: number }) => void;
  undoLast: () => void;
  finish: () => FinishResult | null;
  /** Forget the finished workout (after the summary screen). */
  close: () => void;
}

const WorkoutContext = createContext<Ctx | null>(null);
export function useWorkout(): Ctx {
  const c = useContext(WorkoutContext);
  if (!c) throw new Error('useWorkout must be used inside WorkoutProvider');
  return c;
}

const FLUSH_EVERY_MS = 15_000;

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const flushing = useRef(false);
  const outboxRef = useRef(outbox);
  outboxRef.current = outbox;

  useEffect(() => {
    let on = true;
    void Promise.all([loadActive(), loadOutbox()]).then(([a, q]) => {
      if (!on) return;
      setActive(a);
      setOutbox(q);
      setHydrated(true);
    });
    return () => {
      on = false;
    };
  }, []);

  const updateActive = useCallback((next: ActiveWorkout | null) => {
    setActive(next);
    void saveActive(next);
  }, []);

  const push = useCallback((item: OutboxItem) => {
    const next = enqueue(outboxRef.current, item);
    outboxRef.current = next;
    setOutbox(next);
    void saveOutbox(next);
  }, []);

  /** Send what is queued; keeps whatever fails for the next try. */
  const flush = useCallback(async () => {
    if (flushing.current || !userId || outboxRef.current.length === 0) return;
    flushing.current = true;
    try {
      const sent = new Set<string>();
      await flushOutbox(outboxRef.current, async (item) => {
        // Client-generated ids make a write an idempotent upsert; a delete of a row that is already gone is also fine.
        const { error } = item.op === 'delete' ? await supabase.from(item.table).delete().eq('id', item.id) : await supabase.from(item.table).upsert(item.row as never, { onConflict: 'id' });
        if (!error) sent.add(`${item.table}:${item.id}`);
        return !error;
      });
      // Keep items queued while we were sending, drop what was stored.
      const remaining = outboxRef.current.filter((q) => !sent.has(`${q.table}:${q.id}`));
      outboxRef.current = remaining;
      setOutbox(remaining);
      void saveOutbox(remaining);
    } finally {
      flushing.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    void flush();
    const t = setInterval(() => void flush(), FLUSH_EVERY_MS);
    const onOnline = () => void flush();
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', onOnline);
    return () => {
      clearInterval(t);
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('online', onOnline);
    };
  }, [hydrated, userId, flush]);

  const sessionRow = useCallback(
    (w: ActiveWorkout) => ({ id: w.id, user_id: userId, day_name: w.dayName, started_at: w.startedAt, finished_at: w.finishedAt }),
    [userId],
  );

  const start = useCallback(
    async (input: StartInput) => {
      if (!userId) return;
      const slugs = input.exercises.map((e) => e.slug);
      // Exercise ids and history for pre-fill and PR detection. If offline, start without them.
      let ids = new Map<string, string>();
      let lastWorkout: ActiveWorkout['lastWorkout'] = {};
      let previousBest: ActiveWorkout['previousBest'] = {};
      try {
        const { data: ex } = await supabase.from('exercises').select('id,slug').in('slug', slugs);
        ids = new Map(((ex ?? []) as { id: string; slug: string }[]).map((e) => [e.slug, e.id]));
        if (ids.size > 0) {
          const { data: rows } = await supabase
            .from('set_logs')
            .select('exercise_id,weight_kg,reps,session_id,logged_at')
            .in('exercise_id', [...ids.values()])
            .order('logged_at', { ascending: false })
            .limit(500);
          const h = summarizeHistory((rows ?? []) as unknown as HistoryRow[]);
          for (const [slug, id] of ids) {
            const l = h.last.get(id);
            if (l) lastWorkout[slug] = l;
            const b = h.best.get(id);
            if (b) previousBest[slug] = b;
          }
        }
      } catch {
        ids = new Map();
        lastWorkout = {};
        previousBest = {};
      }
      const planned: PlannedWithId[] = input.exercises.map((e) => ({ ...e, exerciseId: ids.get(e.slug) ?? null }));
      const w: ActiveWorkout = { id: newId(), startedAt: new Date().toISOString(), dayName: input.dayName, planned, logged: [], lastWorkout, previousBest, finishedAt: null };
      updateActive(w);
      push({ id: w.id, table: 'workout_sessions', row: sessionRow(w) });
      void flush();
    },
    [userId, updateActive, push, sessionRow, flush],
  );

  const logSet = useCallback<Ctx['logSet']>(
    (s) => {
      if (!active || !userId) return;
      const exercise = active.planned.find((p) => p.slug === s.slug);
      const setIndex = active.logged.filter((l) => l.slug === s.slug).length;
      const set: ActiveSet = { ...s, id: newId(), setIndex, loggedAt: new Date().toISOString() };
      updateActive({ ...active, logged: [...active.logged, set] });
      if (exercise?.exerciseId) {
        push({
          id: set.id,
          table: 'set_logs',
          row: { id: set.id, user_id: userId, session_id: active.id, exercise_id: exercise.exerciseId, set_index: setIndex, reps: s.reps, weight_kg: s.weightKg, rpe: s.rpe ?? null, logged_at: set.loggedAt },
        });
        void flush();
      }
    },
    [active, userId, updateActive, push, flush],
  );

  const undoLast = useCallback(() => {
    if (!active || active.logged.length === 0) return;
    const last = active.logged[active.logged.length - 1];
    updateActive({ ...active, logged: active.logged.slice(0, -1) });
    // If it was not sent yet, just drop it; otherwise delete the stored row.
    const q = outboxRef.current;
    if (q.some((i) => i.table === 'set_logs' && i.id === last.id)) {
      const next = q.filter((i) => !(i.table === 'set_logs' && i.id === last.id));
      outboxRef.current = next;
      setOutbox(next);
      void saveOutbox(next);
    } else {
      void supabase.from('set_logs').delete().eq('id', last.id);
    }
  }, [active, updateActive]);

  const finish = useCallback((): FinishResult | null => {
    if (!active) return null;
    const finishedAt = new Date().toISOString();
    const done = { ...active, finishedAt };
    updateActive(done);
    push({ id: done.id, table: 'workout_sessions', row: sessionRow(done) });
    void flush();
    const prs = detectPRs(done.logged, new Map(Object.entries(done.previousBest)));
    return {
      prs,
      sets: done.logged.length,
      minutes: Math.max(1, Math.round((Date.parse(finishedAt) - Date.parse(done.startedAt)) / 60000)),
      volume: Math.round(volumeKg(done.logged)),
    };
  }, [active, updateActive, push, sessionRow, flush]);

  const close = useCallback(() => updateActive(null), [updateActive]);

  const queue = useCallback(
    (item: OutboxItem) => {
      push(item);
      void flush();
    },
    [push, flush],
  );

  const value = useMemo<Ctx>(
    () => ({ active, hydrated, pending: outbox.length, outbox, queue, start, logSet, undoLast, finish, close }),
    [active, hydrated, outbox, queue, start, logSet, undoLast, finish, close],
  );
  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}
