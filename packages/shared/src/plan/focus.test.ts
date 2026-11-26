import { describe, expect, it } from 'vitest';
import { workoutFocus } from './index';

describe('workoutFocus', () => {
  it.each([
    ['Push A', 'push'], ['Pull day', 'pull'], ['Legs', 'legs'], ['Upper body', 'upper'], ['Lower A', 'lower'],
    ['Full body 1', 'full'], ['Full-body', 'full'], ['Core and abs', 'core'], ['Chest and triceps', 'push'], ['Back and biceps', 'pull'],
    ['Day 3', 'other'], ['', 'other'],
  ])('%s is %s', (name, focus) => expect(workoutFocus(name)).toBe(focus));
  it('prefers upper/lower/full over a muscle word in the same name', () => {
    expect(workoutFocus('Upper: chest and back')).toBe('upper');
    expect(workoutFocus('Lower body legs')).toBe('lower');
  });
});
