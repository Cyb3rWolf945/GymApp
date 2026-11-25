import { describe, expect, it } from 'vitest';
import { STEP_IDS } from '@gymapp/shared';
import { motion } from '../theme/tokens';
import { countUpValue, createTapLock, durationFor, hapticsAllowed, slideOffset, staggerDelay, stepDirection } from './logic';

describe('motion tokens', () => {
  it('durations are about 150 / 250 / 400 ms and in order', () => {
    expect(motion.duration.fast).toBe(150);
    expect(motion.duration.base).toBe(250);
    expect(motion.duration.slow).toBe(400);
  });
  it('a step entering fits in about 300 ms (base duration plus a short confirmation)', () => {
    expect(motion.duration.base).toBeLessThanOrEqual(300);
  });
  it('easings are cubic-bezier points between 0 and 1', () => {
    for (const e of Object.values(motion.easing)) {
      expect(e).toHaveLength(4);
      expect(e[0]).toBeGreaterThanOrEqual(0);
      expect(e[2]).toBeLessThanOrEqual(1);
    }
  });
});

describe('stepDirection', () => {
  it('forward when the next step is later in the quiz, back when it is earlier', () => {
    expect(stepDirection('welcome', 'goal')).toBe('forward');
    expect(stepDirection('goal', 'welcome')).toBe('back');
    expect(stepDirection('basics', 'target')).toBe('forward');
    expect(stepDirection('consents', 'budget')).toBe('back');
  });
  it('skipping steps (a weight-goal-only step is left out) is still forward', () => {
    expect(stepDirection('basics', 'experience')).toBe('forward');
    expect(stepDirection('experience', 'basics')).toBe('back');
  });
  it('the first screen shown, or the same step, has no direction', () => {
    expect(stepDirection(null, 'goal')).toBe('none');
    expect(stepDirection('goal', 'goal')).toBe('none');
  });
  it('every pair of steps is forward one way and back the other', () => {
    for (const a of STEP_IDS) for (const b of STEP_IDS) {
      if (a === b) continue;
      expect(stepDirection(a, b)).not.toBe(stepDirection(b, a));
    }
  });
});

describe('reduced motion', () => {
  it('no sliding, only a fade', () => {
    expect(slideOffset('forward', true)).toBe(0);
    expect(slideOffset('back', true)).toBe(0);
    expect(slideOffset('forward', false)).toBe(motion.slide);
    expect(slideOffset('back', false)).toBe(-motion.slide);
    expect(slideOffset('none', false)).toBe(0);
  });
  it('one short fade instead of the full duration', () => {
    expect(durationFor('slow', true)).toBe(motion.duration.fast);
    expect(durationFor('slow', false)).toBe(motion.duration.slow);
  });
  it('no stagger', () => {
    expect(staggerDelay(3, true)).toBe(0);
    expect(staggerDelay(0, false)).toBe(0);
    expect(staggerDelay(3, false)).toBe(3 * motion.stagger);
    expect(staggerDelay(-1, false)).toBe(0);
  });
  it('no haptics, and none on the web', () => {
    expect(hapticsAllowed('ios', false)).toBe(true);
    expect(hapticsAllowed('android', false)).toBe(true);
    expect(hapticsAllowed('ios', true)).toBe(false);
    expect(hapticsAllowed('web', false)).toBe(false);
  });
});

describe('countUpValue', () => {
  it('starts at 0, ends exactly at the target, and never overshoots', () => {
    expect(countUpValue(2000, 0)).toBe(0);
    expect(countUpValue(2000, 1)).toBe(2000);
    expect(countUpValue(2000, 2)).toBe(2000);
    expect(countUpValue(2000, -1)).toBe(0);
    for (let p = 0; p <= 1; p += 0.05) expect(countUpValue(2431, p)).toBeLessThanOrEqual(2431);
  });
  it('only goes up, in whole numbers', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const v = countUpValue(1873, p);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe('createTapLock (no double navigation)', () => {
  it('lets the first tap through and ignores the rest', () => {
    const lock = createTapLock();
    expect(lock.locked).toBe(false);
    expect(lock.take()).toBe(true);
    expect(lock.take()).toBe(false);
    expect(lock.take()).toBe(false);
    expect(lock.locked).toBe(true);
  });
  it('each screen gets its own lock', () => {
    const a = createTapLock();
    const b = createTapLock();
    a.take();
    expect(b.take()).toBe(true);
  });
});
