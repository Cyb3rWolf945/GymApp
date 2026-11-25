import { describe, expect, it } from 'vitest';
import { formatUserHistory } from '../ai/history';
import { CheckinInputSchema, checkinDay, isCheckinDue, isCurrentWeek, weekStartKey, workoutsDoneInWeek } from './checkin';

// 2026-11-23 is a Monday.
const d = (day: number) => new Date(2026, 10, day, 12);

describe('weekStartKey', () => {
  it('is the Monday of the week, Sunday included', () => {
    expect(weekStartKey(d(23))).toBe('2026-11-23');
    expect(weekStartKey(d(25))).toBe('2026-11-23');
    expect(weekStartKey(d(29))).toBe('2026-11-23');
    expect(weekStartKey(d(30))).toBe('2026-11-30');
  });
  it('crosses month and year ends', () => {
    expect(weekStartKey(new Date(2027, 0, 1, 12))).toBe('2026-12-28');
  });
});

describe('isCheckinDue', () => {
  it('falls back to Monday without a plan', () => {
    expect(checkinDay([])).toBe('mon');
    expect(isCheckinDue({ today: d(23) })).toBe(true);
    expect(isCheckinDue({ today: d(29) })).toBe(true);
  });
  it('waits for the first workout day of the week', () => {
    const days = ['wed', 'fri'] as const;
    expect(isCheckinDue({ today: d(23), trainingDays: days })).toBe(false);
    expect(isCheckinDue({ today: d(24), trainingDays: days })).toBe(false);
    expect(isCheckinDue({ today: d(25), trainingDays: days })).toBe(true);
    expect(isCheckinDue({ today: d(28), trainingDays: days })).toBe(true);
  });
  it('is not due again once sent or dismissed this week, and returns next week', () => {
    expect(isCheckinDue({ today: d(25), lastCheckinWeek: '2026-11-23' })).toBe(false);
    expect(isCheckinDue({ today: d(25), dismissedWeek: '2026-11-23' })).toBe(false);
    expect(isCheckinDue({ today: d(30), lastCheckinWeek: '2026-11-23', dismissedWeek: '2026-11-23' })).toBe(true);
  });
});

describe('CheckinInputSchema', () => {
  const ok = { weekStart: '2026-11-23', energy: 3, sleep: 4, workoutsDone: 2 };
  it('accepts the minimum and optional fields', () => {
    expect(CheckinInputSchema.safeParse(ok).success).toBe(true);
    expect(CheckinInputSchema.safeParse({ ...ok, weightKg: 80.5, note: 'Slept badly.' }).success).toBe(true);
  });
  it('rejects out-of-range values and long notes', () => {
    for (const bad of [{ energy: 0 }, { energy: 6 }, { sleep: 2.5 }, { workoutsDone: -1 }, { weightKg: 5 }, { weightKg: 900 }, { note: 'x'.repeat(281) }]) {
      expect(CheckinInputSchema.safeParse({ ...ok, ...bad }).success).toBe(false);
    }
  });
});

describe('week helpers', () => {
  it('only accepts the current week', () => {
    expect(isCurrentWeek('2026-11-23', d(26))).toBe(true);
    expect(isCurrentWeek('2026-11-16', d(26))).toBe(false);
    expect(isCurrentWeek('2026-11-30', d(26))).toBe(false);
    expect(isCurrentWeek('2026-11-24', d(26))).toBe(false); // not a Monday
    expect(isCurrentWeek('nope', d(26))).toBe(false);
  });
  it('counts workouts from the week start', () => {
    expect(workoutsDoneInWeek(['2026-11-22T20:00:00', '2026-11-23T08:00:00', '2026-11-25T08:00:00'], '2026-11-23')).toBe(2);
  });
});

describe('check-ins in the planner history', () => {
  it('lists the last 4, newest first, with the cleared note', () => {
    const checkins = [5, 4, 3, 2, 1].map((n) => ({ week: `2026-11-${10 + n}`, weight_kg: 80 + n, energy: n, sleep: 3, done: 2, planned: 3, note: n === 5 ? 'Knee felt <b>tight</b>' : null }));
    const out = formatUserHistory({ checkins });
    expect(out.match(/- Week of/g)).toHaveLength(4);
    expect(out).toContain('energy 5/5, sleep 3/5, 2 of 3 workouts, 85 kg, note: "Knee felt');
    expect(out).not.toContain('<b>');
  });
});
