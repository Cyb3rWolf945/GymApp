import { describe, expect, it } from 'vitest';
import {
  FeedbackSchema, detectPRs, enqueue, epley, flushOutbox, formatRest, inSyncOrder, nextPosition, prefillSet, setLine,
  summarizeHistory, volumeKg, type HistoryRow, type LoggedSet, type OutboxItem, type PlannedExercise,
} from '../index';

describe('epley / PR detection', () => {
  it('estimates the one-rep max', () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(80, 8)).toBeCloseTo(101.33, 1);
    expect(epley(0, 10)).toBe(0);
    expect(epley(60, 0)).toBe(0);
  });
  const sets: LoggedSet[] = [
    { slug: 'bench', weightKg: 80, reps: 8 },
    { slug: 'bench', weightKg: 85, reps: 5 },
    { slug: 'squat', weightKg: 100, reps: 5 },
    { slug: 'row', weightKg: 60, reps: 10 },
  ];
  it('flags exercises that beat the previous best', () => {
    const prs = detectPRs(sets, new Map([['bench', 100], ['squat', 120], ['row', 60]]));
    expect(prs.map((p) => p.slug)).toEqual(['bench', 'row']);
    expect(prs[0]).toMatchObject({ e1rm: 101.3, previous: 100, weightKg: 80, reps: 8 });
  });
  it('does not flag ties, lower results or first-ever results', () => {
    expect(detectPRs([{ slug: 'bench', weightKg: 100, reps: 1 }], new Map([['bench', 100]]))).toEqual([]);
    expect(detectPRs(sets, new Map([['bench', 200]]))).toEqual([]);
    expect(detectPRs(sets, new Map())).toEqual([]);
  });
  it('ignores empty sets', () => {
    expect(detectPRs([{ slug: 'x', weightKg: 0, reps: 10 }], new Map([['x', 1]]))).toEqual([]);
  });
});

const planned: PlannedExercise[] = [
  { slug: 'squat', name: 'Back squat', sets: 2, repsMin: 5, repsMax: 8, restSeconds: 120 },
  { slug: 'row', name: 'Barbell row', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
];
const set = (slug: string, weightKg = 50, reps = 8): LoggedSet => ({ slug, weightKg, reps });

describe('session position and prefill', () => {
  it('walks through the planned sets in order', () => {
    expect(nextPosition(planned, [])).toEqual({ exercise: 0, set: 0 });
    expect(nextPosition(planned, [set('squat')])).toEqual({ exercise: 0, set: 1 });
    expect(nextPosition(planned, [set('squat'), set('squat')])).toEqual({ exercise: 1, set: 0 });
    expect(nextPosition(planned, [set('squat'), set('squat'), set('row'), set('row'), set('row')])).toBeNull();
  });
  it('prefills from this workout, then the last workout, then the rep range', () => {
    expect(prefillSet(planned[0], [set('squat', 90, 6)], { weightKg: 80, reps: 8 })).toEqual({ weightKg: 90, reps: 6 });
    expect(prefillSet(planned[0], [set('row', 40, 10)], { weightKg: 80, reps: 8 })).toEqual({ weightKg: 80, reps: 8 });
    expect(prefillSet(planned[1], [], undefined)).toEqual({ weightKg: 0, reps: 12 });
  });
  it('uses the most recent set of the exercise in this workout', () => {
    expect(prefillSet(planned[0], [set('squat', 80, 8), set('squat', 85, 6)], undefined)).toEqual({ weightKg: 85, reps: 6 });
  });
});

describe('formatting', () => {
  it('formats rest as m:ss', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(5)).toBe('0:05');
    expect(formatRest(-3)).toBe('0:00');
  });
  it('writes the set line', () => {
    expect(setLine(3, 4, 80, 8)).toBe('Set 3 of 4 · 80 kg × 8');
    expect(setLine(1, 3, 22.5, 10)).toBe('Set 1 of 3 · 22.5 kg × 10');
    expect(setLine(1, 3, 0, 12)).toBe('Set 1 of 3 · 12 reps');
  });
  it('sums volume', () => {
    expect(volumeKg([set('a', 50, 10), set('a', 60, 5)])).toBe(800);
  });
});

describe('history summary', () => {
  const rows: HistoryRow[] = [
    { exercise_id: 'e1', weight_kg: 60, reps: 10, session_id: 's1', logged_at: '2026-11-01T10:00:00Z' },
    { exercise_id: 'e1', weight_kg: 100, reps: 3, session_id: 's1', logged_at: '2026-11-01T10:05:00Z' },
    { exercise_id: 'e1', weight_kg: 70, reps: 8, session_id: 's2', logged_at: '2026-11-08T10:00:00Z' },
    { exercise_id: 'e1', weight_kg: 65, reps: 8, session_id: 's2', logged_at: '2026-11-08T10:05:00Z' },
    { exercise_id: 'e2', weight_kg: null, reps: 12, session_id: 's2', logged_at: '2026-11-08T10:10:00Z' },
  ];
  it('pre-fills from the best set of the most recent workout', () => {
    const { last } = summarizeHistory(rows);
    expect(last.get('e1')).toEqual({ weightKg: 70, reps: 8 });
    expect(last.get('e2')).toEqual({ weightKg: 0, reps: 12 });
  });
  it('tracks the best e1RM ever', () => {
    const { best } = summarizeHistory(rows);
    expect(best.get('e1')).toBeCloseTo(110, 0); // 100 × (1 + 3/30)
    expect(best.has('e2')).toBe(false); // bodyweight sets have no e1RM
  });
});

describe('outbox', () => {
  const item = (table: OutboxItem['table'], id: string, v = 1): OutboxItem => ({ table, id, row: { id, v } });
  it('re-queueing the same row keeps the latest version', () => {
    const q = enqueue(enqueue([], item('workout_sessions', 's', 1)), item('workout_sessions', 's', 2));
    expect(q).toHaveLength(1);
    expect(q[0].row.v).toBe(2);
    expect(enqueue(q, item('set_logs', 's')).length).toBe(2); // same id, other table = different row
  });
  it('sends sessions before sets', () => {
    const q = [item('set_logs', 'a'), item('workout_sessions', 's'), item('set_logs', 'b')];
    expect(inSyncOrder(q).map((i) => i.id)).toEqual(['s', 'a', 'b']);
  });
  it('flushes everything when online', async () => {
    const sent: string[] = [];
    const left = await flushOutbox([item('set_logs', 'a'), item('workout_sessions', 's')], async (i) => { sent.push(i.id); return true; });
    expect(left).toEqual([]);
    expect(sent).toEqual(['s', 'a']);
  });
  it('stops at the first failure and keeps the rest, in order', async () => {
    const left = await flushOutbox([item('workout_sessions', 's'), item('set_logs', 'a'), item('set_logs', 'b')], async (i) => i.id === 's');
    expect(left.map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('treats a thrown error like a failure', async () => {
    const left = await flushOutbox([item('workout_sessions', 's')], async () => { throw new Error('offline'); });
    expect(left.map((i) => i.id)).toEqual(['s']);
  });
});

describe('feedback schema', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('accepts an optional rating and a short note', () => {
    expect(FeedbackSchema.safeParse({ sessionId: id }).success).toBe(true);
    expect(FeedbackSchema.safeParse({ sessionId: id, rating: 4, note: 'Felt strong.' }).success).toBe(true);
  });
  it('rejects bad ratings, long notes and bad ids', () => {
    expect(FeedbackSchema.safeParse({ sessionId: id, rating: 6 }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ sessionId: id, note: 'a'.repeat(281) }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ sessionId: 'nope' }).success).toBe(false);
  });
});
