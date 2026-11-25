import { describe, expect, it } from 'vitest';
import type { SetRecord } from '../progress/lifts.ts';
import { exerciseHistory, mediaKind, muscleRoles, parseSteps } from './detail.ts';

describe('parseSteps', () => {
  it('returns nothing for empty or missing text', () => {
    for (const v of [null, undefined, '', '  \n ']) expect(parseSteps(v)).toEqual([]);
  });
  it('takes one step per line and strips the numbering', () => {
    expect(parseSteps('1. Lie on the bench.\n2) Lower the bar.\n- Press up.\n\n• Rack it.')).toEqual(['Lie on the bench.', 'Lower the bar.', 'Press up.', 'Rack it.']);
  });
  it('splits a single paragraph into sentences', () => {
    expect(parseSteps('Stand tall. Hinge at the hips! Keep your back flat?')).toEqual(['Stand tall.', 'Hinge at the hips!', 'Keep your back flat?']);
  });
  it('keeps one line with no punctuation as one step, and does not mangle decimals', () => {
    expect(parseSteps('Hold the bar')).toEqual(['Hold the bar']);
    expect(parseSteps('Use 2.5 kg plates')).toEqual(['Use 2.5 kg plates']);
  });
});

describe('muscleRoles', () => {
  it('splits primary and secondary, drops unknown names, and lets primary win a duplicate', () => {
    const r = muscleRoles([
      { muscle: 'pectoralis_major', role: 'primary' },
      { muscle: 'triceps_brachii', role: 'secondary' },
      { muscle: 'pectoralis_major', role: 'secondary' },
      { muscle: 'not_a_muscle', role: 'primary' },
    ]);
    expect(r).toEqual({ primary: ['pectoralis_major'], secondary: ['triceps_brachii'] });
  });
  it('copes with no rows', () => {
    expect(muscleRoles(null)).toEqual({ primary: [], secondary: [] });
    expect(muscleRoles([])).toEqual({ primary: [], secondary: [] });
  });
});

const set = (slug: string, loggedAt: string, weightKg: number, reps: number): SetRecord => ({ slug, name: slug, loggedAt, weightKg, reps });

describe('exerciseHistory', () => {
  const sets = [
    set('bench', '2026-11-01T10:00:00Z', 60, 10),
    set('bench', '2026-11-01T10:05:00Z', 62.5, 8),
    set('bench', '2026-11-08T10:00:00Z', 65, 8),
    set('bench', '2026-11-15T10:00:00Z', 0, 10), // bodyweight / empty: ignored
    set('squat', '2026-11-16T10:00:00Z', 100, 5), // another exercise
    set('bench', '2026-11-22T10:00:00Z', 70, 5),
  ];
  it('lists the best set of each day, newest first', () => {
    const h = exerciseHistory(sets, 'bench');
    expect(h.sessions.map((s) => s.date)).toEqual(['2026-11-22', '2026-11-08', '2026-11-01']);
    // 60x10 = 80 e1RM beats 62.5x8 = 79.2 on the first day.
    expect(h.sessions[2]).toMatchObject({ weightKg: 60, reps: 10, e1rm: 80 });
  });
  it('reports the best e1RM and the trend oldest first', () => {
    const h = exerciseHistory(sets, 'bench');
    expect(h.bestE1rm).toBe(82.3);
    expect(h.trend.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-08', '2026-11-22']);
  });
  it('keeps only the last N sessions in the list, but all of them in the trend', () => {
    const many = Array.from({ length: 8 }, (_, i) => set('bench', `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`, 50 + i, 8));
    const h = exerciseHistory(many, 'bench');
    expect(h.sessions).toHaveLength(5);
    expect(h.sessions[0].date).toBe('2026-11-08');
    expect(h.trend).toHaveLength(8);
  });
  it('is empty for an exercise never logged', () => {
    expect(exerciseHistory(sets, 'deadlift')).toEqual({ sessions: [], bestE1rm: null, trend: [] });
  });
});

describe('mediaKind', () => {
  it('tells images from videos by extension, ignoring query strings', () => {
    expect(mediaKind('https://cdn.example.com/a/bench.JPG')).toBe('image');
    expect(mediaKind('https://cdn.example.com/bench.webp?w=400')).toBe('image');
    expect(mediaKind('http://cdn.example.com/bench.mp4#t=1')).toBe('video');
  });
  it('returns null for nothing, unknown types and non-http links', () => {
    for (const v of [null, undefined, '', '   ', 'https://example.com/page', 'javascript:alert(1)', 'file:///etc/a.png', '/local/a.png']) expect(mediaKind(v), String(v)).toBeNull();
  });
});
