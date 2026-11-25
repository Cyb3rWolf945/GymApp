import { describe, expect, it } from 'vitest';
import { en } from './en';
import { plural } from './plural';

describe('plural', () => {
  it('0 and 2 are plural, 1 is singular', () => {
    expect(plural(0, 'set')).toBe('0 sets');
    expect(plural(1, 'set')).toBe('1 set');
    expect(plural(2, 'set')).toBe('2 sets');
  });
  it('irregular plurals', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(3, 'entry', 'entries')).toBe('3 entries');
  });
});

describe('counts in the copy read correctly at 0, 1 and 2', () => {
  it('workout summary: "1 set", never "1 sets"', () => {
    const s = en.workout.summary.stats;
    expect(s(0, 1, 0)).toBe('0 sets · 1 min · 0 kg lifted');
    expect(s(1, 1, 0)).toBe('1 set · 1 min · 0 kg lifted');
    expect(s(2, 30, 1250)).toBe('2 sets · 30 min · 1,250 kg lifted');
  });
  it('workout history line', () => {
    const l = en.workout.history.sessionLine;
    expect(l(0, 0)).toBe('0 sets · 0 kg');
    expect(l(1, 100)).toBe('1 set · 100 kg');
    expect(l(2, 1000)).toBe('2 sets · 1,000 kg');
  });
  it('muscle sets on Progress', () => {
    const f = en.home.progress.sets;
    expect([f(0), f(1), f(2)]).toEqual(['0 sets', '1 set', '2 sets']);
  });
  it('Today: exercises in the workout', () => {
    const f = en.home.workoutMeta;
    expect(f(0, 10)).toBe('0 exercises · about 10 min');
    expect(f(1, 10)).toBe('1 exercise · about 10 min');
    expect(f(2, 10)).toBe('2 exercises · about 10 min');
  });
  it('servings and portions', () => {
    expect([0, 1, 2].map(en.plan.preview.portions)).toEqual(['0 servings', '1 serving', '2 servings']);
    expect([0, 1, 2].map(en.nutrition.recipe.portions)).toEqual(['0 portions', '1 portion', '2 portions']);
  });
  it('chart descriptions for screen readers', () => {
    expect(en.home.progress.weightChart(1)).toBe('Line chart of your 7-day average weight over 1 entry');
    expect(en.home.progress.weightChart(2)).toBe('Line chart of your 7-day average weight over 2 entries');
    expect(en.home.progress.trendChart('Bench press', 1)).toBe('Line chart of your estimated one-rep max for Bench press over 1 workout');
    expect(en.home.progress.trendChart('Bench press', 2)).toBe('Line chart of your estimated one-rep max for Bench press over 2 workouts');
  });
});
