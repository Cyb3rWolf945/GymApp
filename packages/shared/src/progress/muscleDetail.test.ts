import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS } from '../catalog/catalog.ts';
import {
  GROWTH_SETS_PER_WEEK, type LibraryExercise, READY_MAX_DAYS, RECOVERING_MAX_DAYS, TOP_EXERCISES, TREND_WEEKS,
  daysSinceTrained, muscleDetail, muscleSequence, muscleStatus, muscleView, trainNextCandidates,
} from './muscleDetail.ts';
import { type MuscleSet, muscleStats } from './muscles.ts';

const NOW = new Date('2026-11-26T12:00:00Z');
const DAY = 86_400_000;
const ago = (days: number, hour = 9) => new Date(Date.UTC(2026, 10, 26 - days, hour)).toISOString();

const quad = (slug: string, name: string, loggedAt: string, role: 'primary' | 'secondary' = 'primary'): MuscleSet => ({ slug, name, loggedAt, muscles: [{ muscle: 'quadriceps', role }] });
const times = (n: number, make: () => MuscleSet) => Array.from({ length: n }, make);

describe('muscleStatus (days since last trained)', () => {
  it.each([[null, 'fresh'], [0, 'recovering'], [1, 'recovering'], [2, 'recovering'], [3, 'ready'], [6, 'ready'], [7, 'fresh'], [30, 'fresh']] as const)('%s days -> %s', (days, status) => {
    expect(muscleStatus(days)).toBe(status);
  });
  it('the boundaries are the exported constants', () => {
    expect(RECOVERING_MAX_DAYS).toBe(2);
    expect(READY_MAX_DAYS).toBe(6);
  });
});

describe('daysSinceTrained', () => {
  it('counts calendar days: today is 0, yesterday 1, whatever the time of day', () => {
    expect(daysSinceTrained('2026-11-26', NOW)).toBe(0);
    expect(daysSinceTrained('2026-11-25', NOW)).toBe(1);
    expect(daysSinceTrained('2026-11-19', NOW)).toBe(7);
    expect(daysSinceTrained('2026-11-26', new Date('2026-11-26T23:59:00Z'))).toBe(0);
  });
  it('is null for never, and never negative for a date in the future', () => {
    expect(daysSinceTrained(null, NOW)).toBeNull();
    expect(daysSinceTrained('nonsense', NOW)).toBeNull();
    expect(daysSinceTrained('2026-12-01', NOW)).toBe(0);
  });
});

describe('muscleDetail', () => {
  it('has eight weeks, oldest first, the last one being the current week', () => {
    const d = muscleDetail('quadriceps', [quad('squat', 'Squat', ago(1)), quad('squat', 'Squat', ago(8)), quad('squat', 'Squat', ago(15))], NOW);
    expect(d.weeks).toHaveLength(TREND_WEEKS);
    expect(d.weeks.map((w) => w.weeksAgo)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(d.weeks[7].sets).toBe(1); // the last 7 days
    expect(d.weeks[6].sets).toBe(1);
    expect(d.weeks[5].sets).toBe(1);
    expect(d.weeks.slice(0, 5).every((w) => w.sets === 0)).toBe(true);
  });
  it('counts a primary set as 1 and a secondary set as 0.5, and ignores sets older than 8 weeks, in the future or invalid', () => {
    const sets: MuscleSet[] = [
      quad('a', 'A', ago(1), 'primary'),
      quad('b', 'B', ago(2), 'secondary'),
      quad('old', 'Old', ago(70)),
      quad('future', 'Future', new Date(NOW.getTime() + DAY).toISOString()),
      quad('bad', 'Bad', 'not a date'),
      { slug: 'other', name: 'Other', loggedAt: ago(1), muscles: [{ muscle: 'hamstrings', role: 'primary' }] },
    ];
    const d = muscleDetail('quadriceps', sets, NOW);
    expect(d.weeks[7].sets).toBe(1.5);
    expect(d.weeks.reduce((n, w) => n + w.sets, 0)).toBe(1.5);
    expect(d.sets).toBe(1.5);
    expect(d.lastTrained).toBe('2026-11-25');
  });
  it('matches muscleStats for the sets and the last trained date, in both periods', () => {
    const sets = [...times(6, () => quad('s', 'Squat', ago(1))), ...times(8, () => quad('l', 'Lunge', ago(12), 'secondary')), quad('x', 'X', ago(40))];
    for (const period of [7, 30] as const) {
      const stat = muscleStats(sets, NOW, period).get('quadriceps')!;
      const d = muscleDetail('quadriceps', sets, NOW, period);
      expect(d.sets, `sets, ${period} days`).toBe(stat.sets);
      expect(d.lastTrained).toBe(stat.lastTrained);
    }
  });
  it('a 30-day period is a weekly average, so the same heat bands apply', () => {
    const sets = times(30, () => quad('s', 'Squat', ago(10))); // 30 sets in 30 days = 7 a week
    const d = muscleDetail('quadriceps', sets, NOW, 30);
    expect(d.sets).toBe(7);
    expect(d.heat).toBe(2); // 5-9 sets a week
  });
  it('sets the status from the days since the last set', () => {
    const at = (days: number) => muscleDetail('quadriceps', [quad('s', 'S', ago(days))], NOW);
    expect(at(0).status).toBe('recovering');
    expect(at(2).status).toBe('recovering');
    expect(at(3).status).toBe('ready');
    expect(at(6).status).toBe('ready');
    expect(at(7).status).toBe('fresh');
    expect(at(0).daysSince).toBe(0);
    expect(muscleDetail('quadriceps', [], NOW)).toMatchObject({ status: 'fresh', daysSince: null, lastTrained: null, trained: false, sets: 0, heat: 0 });
  });
  it('shares: primary and secondary roles, ordered by sets, adding up to 1 over all exercises', () => {
    const sets = [...times(4, () => quad('squat', 'Squat', ago(1))), ...times(4, () => quad('lunge', 'Lunge', ago(2), 'secondary')), ...times(2, () => quad('press', 'Leg press', ago(3)))];
    const d = muscleDetail('quadriceps', sets, NOW);
    expect(d.topExercises.map((e) => [e.slug, e.sets, e.role])).toEqual([['squat', 4, 'primary'], ['press', 2, 'primary'], ['lunge', 2, 'secondary']]);
    expect(d.topExercises.reduce((n, e) => n + e.share, 0)).toBeCloseTo(1, 1);
    expect(d.topExercises[0].share).toBeCloseTo(0.5, 2);
  });
  it('lists at most five exercises, and their shares then add up to less than 1', () => {
    const sets = Array.from({ length: 7 }, (_, i) => quad(`e${i}`, `Exercise ${i}`, ago(1))).flatMap((s) => [s, s]);
    const d = muscleDetail('quadriceps', sets, NOW);
    expect(d.topExercises).toHaveLength(TOP_EXERCISES);
    expect(d.topExercises.reduce((n, e) => n + e.share, 0)).toBeLessThan(1);
  });
  it('calls an exercise primary if it is the main one in any set, secondary only if it never is', () => {
    const d = muscleDetail('quadriceps', [quad('x', 'X', ago(1), 'secondary'), quad('x', 'X', ago(2), 'primary')], NOW);
    expect(d.topExercises[0].role).toBe('primary');
  });
  it('is trained when any of the 8 weeks has sets, even if the chosen period has none', () => {
    const d = muscleDetail('quadriceps', [quad('s', 'S', ago(40))], NOW, 7);
    expect(d.trained).toBe(true);
    expect(d.sets).toBe(0);
    expect(d.topExercises).toEqual([]);
  });
  it('the growth guideline is a constant, 10 to 20 sets a week', () => {
    expect(GROWTH_SETS_PER_WEEK).toEqual({ min: 10, max: 20 });
  });
});

const lib = (slug: string, over: Partial<LibraryExercise> = {}): LibraryExercise => ({
  slug, name: slug, equipment: 'bodyweight', level: 'beginner', contraindications: [], muscles: [{ muscle: 'quadriceps', role: 'primary' }], ...over,
});
const profile = { equipment: ['dumbbells'], contraindications: [] as string[], level: 'intermediate' };

describe('trainNextCandidates', () => {
  it('only suggests exercises where the muscle is the main one', () => {
    const library = [lib('squat'), lib('curl', { muscles: [{ muscle: 'biceps_brachii', role: 'primary' }] }), lib('helper', { muscles: [{ muscle: 'quadriceps', role: 'secondary' }] })];
    expect(trainNextCandidates('quadriceps', library, profile).map((e) => e.slug)).toEqual(['squat']);
  });
  it('respects the equipment (bodyweight always, a gym or basic gym expands to what it has), and skips unknown equipment', () => {
    const library = [lib('goblet', { equipment: 'dumbbells' }), lib('barbell-squat', { equipment: 'barbell' }), lib('press', { equipment: 'full_gym' }), lib('mystery', { equipment: null }), lib('air')];
    expect(trainNextCandidates('quadriceps', library, profile).map((e) => e.slug).sort()).toEqual(['air', 'goblet']);
    expect(trainNextCandidates('quadriceps', library, { ...profile, equipment: ['basic_gym'] }).map((e) => e.slug).sort()).toEqual(['air', 'barbell-squat', 'goblet']);
    expect(trainNextCandidates('quadriceps', library, { ...profile, equipment: ['full_gym'] }, new Map(), 10).map((e) => e.slug).sort()).toEqual(['air', 'barbell-squat', 'goblet', 'press']);
  });
  it('skips exercises that touch a declared injury area', () => {
    const library = [lib('lunge', { contraindications: ['knee'] }), lib('squat', { contraindications: ['lower_back', 'hip'] }), lib('air')];
    expect(trainNextCandidates('quadriceps', library, { ...profile, contraindications: ['knee'] }).map((e) => e.slug).sort()).toEqual(['air', 'squat']);
    expect(trainNextCandidates('quadriceps', library, { ...profile, contraindications: ['knee', 'hip'] }).map((e) => e.slug)).toEqual(['air']);
  });
  it('never goes above the person\'s level', () => {
    const library = [lib('easy'), lib('mid', { level: 'intermediate' }), lib('hard', { level: 'advanced' })];
    expect(trainNextCandidates('quadriceps', library, { ...profile, level: 'beginner' }).map((e) => e.slug)).toEqual(['easy']);
    expect(trainNextCandidates('quadriceps', library, { ...profile, level: 'advanced' }).map((e) => e.slug).sort()).toEqual(['easy', 'hard', 'mid']);
  });
  it('prefers exercises not done lately: never done first, then the longest ago', () => {
    const library = [lib('a'), lib('b'), lib('c'), lib('d')];
    const lastDone = new Map([['a', ago(1)], ['b', ago(20)], ['c', ago(5)]]);
    expect(trainNextCandidates('quadriceps', library, profile, lastDone, 4).map((e) => e.slug)).toEqual(['d', 'b', 'c', 'a']);
  });
  it('gives at most three by default, and none when nothing fits', () => {
    const library = Array.from({ length: 6 }, (_, i) => lib(`e${i}`));
    expect(trainNextCandidates('quadriceps', library, profile)).toHaveLength(3);
    expect(trainNextCandidates('quadriceps', library, profile, new Map(), 2)).toHaveLength(2);
    expect(trainNextCandidates('hamstrings', library, profile)).toEqual([]);
    expect(trainNextCandidates('quadriceps', [], profile)).toEqual([]);
  });
  it('treats an unknown level as the easiest, and missing contraindications as none', () => {
    const library = [lib('x', { level: null, contraindications: null })];
    expect(trainNextCandidates('quadriceps', library, { ...profile, level: 'beginner' }).map((e) => e.slug)).toEqual(['x']);
    expect(trainNextCandidates('quadriceps', [lib('y', { level: 'intermediate' })], { ...profile, level: 'nonsense' })).toEqual([]);
  });
});

describe('muscleSequence and muscleView', () => {
  it('lists each muscle of a view once, top to bottom', () => {
    for (const view of ['front', 'back'] as const) {
      const seq = muscleSequence(view);
      expect(seq.length).toBeGreaterThan(5);
      expect(new Set(seq).size).toBe(seq.length);
      expect(seq.every((m) => (MUSCLE_IDS as readonly string[]).includes(m))).toBe(true);
      expect(seq.every((m) => muscleView(m) !== null)).toBe(true);
    }
  });
  it('shows a muscle in the view that draws it', () => {
    expect(muscleView('quadriceps')).toBe('front');
    expect(muscleView('latissimus_dorsi')).toBe('back');
    expect(muscleSequence('front')).toContain('quadriceps');
    expect(muscleSequence('back')).toContain('hamstrings');
  });
});
