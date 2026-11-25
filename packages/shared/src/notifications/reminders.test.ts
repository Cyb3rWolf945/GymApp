import { describe, expect, it } from 'vitest';
import {
  EXPO_BATCH_SIZE, EXPO_TOKEN_PATTERN, MAX_REMINDER_LENGTH, chunkMessages, deadTokens, decideReminder, pushMessage, reminderMessage,
} from '../index';

describe('reminderMessage', () => {
  it('uses the spec wording', () => {
    expect(reminderMessage({ dayName: 'Leg day', name: 'Ana', minutes: 45 })).toBe("Leg day, Ana. 45 min and you're done.");
  });
  it('is always under 60 characters', () => {
    for (const day of ['Day A', 'Upper body hypertrophy and conditioning day', 'x'.repeat(200)]) {
      for (const name of ['Ana', 'Maximilian-Alexander', null, '']) {
        const m = reminderMessage({ dayName: day, name, minutes: 90 });
        expect(m.length, `${day}/${name}`).toBeLessThanOrEqual(MAX_REMINDER_LENGTH);
        expect(m).toContain("min and you're done.");
      }
    }
  });
  it('drops the name before it cuts the day name, and omits a missing name', () => {
    expect(reminderMessage({ dayName: 'Upper body strength day', name: 'Maximilian-Alexander', minutes: 60 })).toBe("Upper body strength day. 60 min and you're done.");
    expect(reminderMessage({ dayName: 'Push day', name: null, minutes: 30 })).toBe("Push day. 30 min and you're done.");
    expect(reminderMessage({ dayName: '  ', name: 'Ana', minutes: 30 })).toBe("Workout day, Ana. 30 min and you're done.");
  });
  it('rounds minutes and never says 0', () => {
    expect(reminderMessage({ dayName: 'A', minutes: 0 })).toBe("A. 1 min and you're done.");
    expect(reminderMessage({ dayName: 'A', minutes: 44.6 })).toContain('45 min');
  });
});

const line = (s: string) => ({ exerciseSlug: s, sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90 });
const workout = { plan: { split: 'full_body', rationale: 'x', days: [{ name: 'Day A', exercises: [line('a'), line('b')] }, { name: 'Leg day', exercises: [line('c')] }, { name: 'Day C', exercises: [line('d')] }] } };

describe('decideReminder', () => {
  // Default schedule for 3 days: Monday, Wednesday, Friday.
  it('reminds on a training day with that day\'s name', () => {
    const d = decideReminder({ workoutResult: workout, isoWeekday: 3, trainedToday: false, name: 'Ana' });
    expect(d.send).toBe(true);
    expect(d.message).toMatch(/^Leg day, Ana\. \d+ min and you're done\.$/);
  });
  it('stays quiet on rest days, when already trained, or without a plan', () => {
    expect(decideReminder({ workoutResult: workout, isoWeekday: 2, trainedToday: false })).toEqual({ send: false, reason: 'rest_day' });
    expect(decideReminder({ workoutResult: workout, isoWeekday: 3, trainedToday: true })).toEqual({ send: false, reason: 'already_trained' });
    expect(decideReminder({ workoutResult: null, isoWeekday: 3, trainedToday: false })).toEqual({ send: false, reason: 'no_plan' });
    expect(decideReminder({ workoutResult: { plan: 5 }, isoWeekday: 3, trainedToday: false })).toEqual({ send: false, reason: 'no_plan' });
  });
  it('uses the preferred days', () => {
    const d = decideReminder({ workoutResult: workout, preferredDays: ['tue', 'thu', 'sat'], isoWeekday: 4, trainedToday: false });
    expect(d.send).toBe(true);
    expect(d.message).toContain('Leg day');
    expect(decideReminder({ workoutResult: workout, preferredDays: ['tue', 'thu', 'sat'], isoWeekday: 1, trainedToday: false }).send).toBe(false);
  });
});

describe('Expo push helpers', () => {
  it('accepts Expo token formats only', () => {
    expect(EXPO_TOKEN_PATTERN.test('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
    expect(EXPO_TOKEN_PATTERN.test('ExpoPushToken[abc_DEF-123456]')).toBe(true);
    for (const bad of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[bad token!]', "ExponentPushToken[x'); drop table x;--]"]) expect(EXPO_TOKEN_PATTERN.test(bad), bad).toBe(false);
  });
  it('builds a message that opens the app', () => {
    expect(pushMessage('ExponentPushToken[abcdefgh]', 'Hi')).toEqual({ to: 'ExponentPushToken[abcdefgh]', body: 'Hi', sound: 'default', data: { url: '/' } });
  });
  it('chunks into batches of at most 100', () => {
    const m = Array.from({ length: 250 }, (_, i) => i);
    expect(EXPO_BATCH_SIZE).toBe(100);
    expect(chunkMessages(m).map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunkMessages([])).toEqual([]);
  });
  it('finds tokens Expo says are dead', () => {
    const msgs = [{ to: 'a' }, { to: 'b' }, { to: 'c' }];
    expect(deadTokens(msgs, [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }])).toEqual(['b']);
    expect(deadTokens(msgs, [])).toEqual([]);
  });
});

import { localDateKey } from '../index';

describe('localDateKey', () => {
  it('follows the time zone', () => {
    expect(localDateKey('2026-11-25T20:30:00Z', 'UTC')).toBe('2026-11-25');
    expect(localDateKey('2026-11-25T20:30:00Z', 'Asia/Tokyo')).toBe('2026-11-26');
    expect(localDateKey(new Date('2026-11-25T02:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-24');
  });
});
