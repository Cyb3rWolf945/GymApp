import { describe, expect, it } from 'vitest';
import { personalRecords } from '../progress/lifts.ts';
import { type OutboxItem, enqueue, flushOutbox, inSyncOrder } from './outbox.ts';
import {
  type SessionInfo, type SessionSet, applyQueuedEdits, buildSessionDetail, sessionDeleteItem, sessionIsDeleted, setDeleteItem, setEditItem, toSetRecords, validateSetEdit,
} from './sessionDetail.ts';

const session: SessionInfo = { id: 's1', dayName: 'Upper body', startedAt: '2026-11-20T10:00:00Z', finishedAt: '2026-11-20T10:45:00Z', rating: 4 };
const set = (id: string, slug: string, i: number, kg: number, reps: number, rpe: number | null = null, at = `2026-11-20T10:0${i}:00Z`): SessionSet => ({
  id, exerciseId: `ex-${slug}`, slug, name: slug === 'bench' ? 'Bench press' : 'Overhead press', setIndex: i, reps, weightKg: kg, rpe, loggedAt: at,
});
const sets = [set('a', 'bench', 0, 100, 5, 8), set('b', 'bench', 1, 100, 5, 9), set('c', 'ohp', 0, 50, 8), set('d', 'bench', 2, 1000, 5)];

describe('buildSessionDetail', () => {
  const detail = buildSessionDetail(session, sets);
  it('shows date, duration, title, rating and the totals', () => {
    expect(detail).toMatchObject({ id: 's1', title: 'Upper body', startedAt: session.startedAt, minutes: 45, rating: 4, totalSets: 4 });
    expect(detail.volume).toBe(100 * 5 + 100 * 5 + 50 * 8 + 1000 * 5);
  });
  it('groups by exercise in the order they were first done, with every set numbered', () => {
    expect(detail.exercises.map((e) => e.slug)).toEqual(['bench', 'ohp']);
    expect(detail.exercises[0].sets.map((s) => [s.number, s.weightKg, s.reps, s.rpe])).toEqual([[1, 100, 5, 8], [2, 100, 5, 9], [3, 1000, 5, null]]);
  });
  it('an unfinished workout has no duration; a very short one is at least a minute', () => {
    expect(buildSessionDetail({ ...session, finishedAt: null }, sets).minutes).toBeNull();
    expect(buildSessionDetail({ ...session, finishedAt: session.startedAt }, sets).minutes).toBe(1);
  });
  it('handles a workout with no sets and sets with missing numbers', () => {
    expect(buildSessionDetail(session, [])).toMatchObject({ totalSets: 0, volume: 0, exercises: [] });
    const odd = buildSessionDetail(session, [{ ...set('x', 'bench', 0, 0, 0), weightKg: null, reps: null }]);
    expect(odd.exercises[0].sets[0]).toMatchObject({ weightKg: 0, reps: 0 });
  });
});

describe('validateSetEdit', () => {
  it('accepts a normal set', () => expect(validateSetEdit({ weightKg: 100, reps: 5, rpe: 8 })).toEqual([]));
  it('accepts no RPE, bodyweight (0 kg), and the limits', () => {
    expect(validateSetEdit({ weightKg: 0, reps: 10, rpe: null })).toEqual([]);
    expect(validateSetEdit({ weightKg: 500, reps: 100, rpe: 10 })).toEqual([]);
  });
  it('refuses a typo like 1000 kg', () => expect(validateSetEdit({ weightKg: 1000, reps: 5, rpe: null })).toEqual(['weight']));
  it('refuses negative or missing numbers, zero or fractional reps, and a wild RPE', () => {
    expect(validateSetEdit({ weightKg: -1, reps: 5, rpe: null })).toEqual(['weight']);
    expect(validateSetEdit({ weightKg: Number.NaN, reps: 5, rpe: null })).toEqual(['weight']);
    expect(validateSetEdit({ weightKg: 50, reps: 0, rpe: null })).toEqual(['reps']);
    expect(validateSetEdit({ weightKg: 50, reps: 2.5, rpe: null })).toEqual(['reps']);
    expect(validateSetEdit({ weightKg: 50, reps: 5, rpe: 11 })).toEqual(['rpe']);
    expect(validateSetEdit({ weightKg: 5000, reps: 0, rpe: 0 })).toEqual(['weight', 'reps', 'rpe']);
  });
});

describe('queued corrections', () => {
  const fix = setEditItem('u1', 's1', sets[3], { weightKg: 100, reps: 5, rpe: 8 });
  it('an edit is the whole row again, with the same id, so sending it twice is harmless', () => {
    expect(fix).toMatchObject({ id: 'd', table: 'set_logs', row: { id: 'd', user_id: 'u1', session_id: 's1', exercise_id: 'ex-bench', set_index: 2, reps: 5, weight_kg: 100, rpe: 8, logged_at: sets[3].loggedAt } });
    expect(fix.op).toBeUndefined();
  });
  it('shows the corrected set at once, before it has been sent', () => {
    const shown = applyQueuedEdits(sets, 's1', [fix]);
    expect(shown.find((s) => s.id === 'd')).toMatchObject({ weightKg: 100, reps: 5, rpe: 8 });
    expect(shown).toHaveLength(4);
    expect(sets[3].weightKg).toBe(1000); // the stored data is not changed in place
  });
  it('shows a deleted set as gone', () => {
    expect(applyQueuedEdits(sets, 's1', [setDeleteItem('b')]).map((s) => s.id)).toEqual(['a', 'c', 'd']);
  });
  it('ignores queued rows of another workout and of other tables', () => {
    const other = setEditItem('u1', 'other', sets[0], { weightKg: 1, reps: 1, rpe: null });
    expect(applyQueuedEdits(sets, 's1', [other])).toEqual(sets);
    expect(applyQueuedEdits(sets, 's1', [{ id: 's1', table: 'workout_sessions', row: {} }])).toEqual(sets);
  });
  it('a later edit of the same set replaces the earlier one in the queue', () => {
    let q: OutboxItem[] = [];
    q = enqueue(q, setEditItem('u1', 's1', sets[3], { weightKg: 90, reps: 5, rpe: null }));
    q = enqueue(q, setEditItem('u1', 's1', sets[3], { weightKg: 100, reps: 5, rpe: null }));
    expect(q).toHaveLength(1);
    expect(applyQueuedEdits(sets, 's1', q).find((s) => s.id === 'd')!.weightKg).toBe(100);
  });
  it('a delete replaces an earlier edit of the same set', () => {
    let q: OutboxItem[] = [setEditItem('u1', 's1', sets[3], { weightKg: 90, reps: 5, rpe: null })];
    q = enqueue(q, setDeleteItem('d'));
    expect(q).toHaveLength(1);
    expect(q[0].op).toBe('delete');
  });
  it('a deleted workout is known', () => {
    expect(sessionIsDeleted('s1', [sessionDeleteItem('s1')])).toBe(true);
    expect(sessionIsDeleted('s1', [sessionDeleteItem('s2')])).toBe(false);
    expect(sessionIsDeleted('s1', [])).toBe(false);
  });
});

describe('sync order', () => {
  it('writes first (sessions before sets), then deleted sets, then deleted workouts', () => {
    const queue: OutboxItem[] = [
      sessionDeleteItem('s9'),
      setDeleteItem('x'),
      setEditItem('u1', 's1', sets[0], { weightKg: 90, reps: 5, rpe: null }),
      { id: 's1', table: 'workout_sessions', row: { id: 's1' } },
    ];
    expect(inSyncOrder(queue).map((i) => `${i.table}:${i.op ?? 'upsert'}`)).toEqual(['workout_sessions:upsert', 'set_logs:upsert', 'set_logs:delete', 'workout_sessions:delete']);
  });
  it('flushing stops at the first failure and keeps the rest, deletes included', async () => {
    const queue: OutboxItem[] = [setEditItem('u1', 's1', sets[0], { weightKg: 90, reps: 5, rpe: null }), setDeleteItem('x')];
    const left = await flushOutbox(queue, async (i) => i.op !== 'delete');
    expect(left.map((i) => i.id)).toEqual(['x']);
  });
});

describe('records after a correction', () => {
  const records = (rows: SessionSet[]) => toSetRecords(rows);
  it('the typo makes a fake record; correcting it brings the real one back', () => {
    const before = personalRecords(records(sets)).find((r) => r.slug === 'bench')!;
    expect(before.weightKg).toBe(1000);
    const fixed = applyQueuedEdits(sets, 's1', [setEditItem('u1', 's1', sets[3], { weightKg: 100, reps: 5, rpe: null })]);
    const after = personalRecords(records(fixed)).find((r) => r.slug === 'bench')!;
    expect(after.weightKg).toBe(100);
    expect(after.e1rm).toBeLessThan(before.e1rm);
    expect(after.e1rm).toBeCloseTo(116.7, 1);
  });
  it('deleting the typo set does the same', () => {
    const gone = applyQueuedEdits(sets, 's1', [setDeleteItem('d')]);
    expect(personalRecords(records(gone)).find((r) => r.slug === 'bench')!.weightKg).toBe(100);
  });
  it('deleting the only set of an exercise removes its record', () => {
    const gone = applyQueuedEdits(sets, 's1', [setDeleteItem('c')]);
    expect(personalRecords(records(gone)).find((r) => r.slug === 'ohp')).toBeUndefined();
  });
  it('sets without reps are not records', () => {
    expect(toSetRecords([set('z', 'bench', 0, 100, 0)])).toEqual([]);
  });
});
