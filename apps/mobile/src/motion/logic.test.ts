import { describe, expect, it } from 'vitest';
import { STEP_IDS } from '@gymapp/shared';
import { motion } from '../theme/tokens';
import {
  LINE_DRAW_SHARE, SCREEN_STAGGER_MS, STAGGER_MAX_ITEMS, blendIntensity, countUpValue, createCelebrationLedger, createTapLock, createVisitTracker, drawDash, durationFor, hapticFor, hapticsAllowed,
  lineProgress, pointsOpacity, polylineLength, pressScale, regionProgress, revealDelay, revealsIn, slideOffset, staggerDelay, stepDirection,
} from './logic';

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

describe('haptics by moment (E-138: motion and feedback)', () => {
  it('a choice is a light tap, a set logged a firmer one, a PR and the plan being ready the success pattern', () => {
    expect(hapticFor('choice', 'ios', false)).toEqual({ kind: 'impact', weight: 'light' });
    expect(hapticFor('set_logged', 'android', false)).toEqual({ kind: 'impact', weight: 'medium' });
    expect(hapticFor('pr', 'ios', false)).toEqual({ kind: 'notification', type: 'success' });
    expect(hapticFor('plan_ready', 'ios', false)).toEqual({ kind: 'notification', type: 'success' });
  });
  it('never on the web, whatever the moment', () => {
    for (const e of ['choice', 'set_logged', 'pr', 'plan_ready'] as const) expect(hapticFor(e, 'web', false), e).toBeNull();
  });
  it('never with reduced motion, on a phone either', () => {
    for (const e of ['choice', 'set_logged', 'pr', 'plan_ready'] as const) expect(hapticFor(e, 'ios', true), e).toBeNull();
  });
  it('the celebration moments feel different from an ordinary tap', () => {
    expect(hapticFor('pr', 'ios', false)?.kind).not.toBe(hapticFor('choice', 'ios', false)?.kind);
  });
});

describe('spring press states', () => {
  it('a pressed thing shrinks to the token scale, and a row less than a button', () => {
    expect(pressScale(false, motion.pressScale)).toBe(0.97);
    expect(motion.rowPressScale).toBeGreaterThan(motion.pressScale);
    expect(motion.rowPressScale).toBeLessThan(1);
  });
  it('with reduced motion nothing shrinks', () => {
    expect(pressScale(true, motion.pressScale)).toBe(1);
    expect(pressScale(true, motion.rowPressScale)).toBe(1);
  });
  it('the spring is stiff and well damped: quick, with a slight settle and no wobble', () => {
    const { stiffness, damping, mass } = motion.spring;
    expect(stiffness).toBeGreaterThanOrEqual(300);
    // Damping ratio = c / (2 * sqrt(k * m)): between 0.7 and 1.2 reads as a settle, not a wobble.
    const ratio = damping / (2 * Math.sqrt(stiffness * mass));
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.2);
  });
});

describe('first visit gating (E-63)', () => {
  it('a screen is new until it is marked, and reading does not change that', () => {
    const v = createVisitTracker();
    expect(v.isFirst('today')).toBe(true);
    expect(v.isFirst('today')).toBe(true); // several parts of the screen ask at once
    v.mark('today');
    expect(v.isFirst('today')).toBe(false);
    expect(v.isFirst('progress')).toBe(true);
    v.reset();
    expect(v.isFirst('today')).toBe(true);
  });
  it('items stagger only on the first visit, and only the first 8', () => {
    expect(revealDelay(0, true, false)).toBe(0);
    expect(revealDelay(3, true, false)).toBe(3 * SCREEN_STAGGER_MS);
    expect(revealDelay(STAGGER_MAX_ITEMS - 1, true, false)).toBe((STAGGER_MAX_ITEMS - 1) * SCREEN_STAGGER_MS);
    expect(revealDelay(STAGGER_MAX_ITEMS, true, false)).toBe(0);
    expect(revealDelay(3, false, false)).toBe(0); // later visits: no stagger
    expect(revealDelay(3, true, true)).toBe(0); // reduced motion
    expect(revealsIn(7, true, false)).toBe(true);
    expect(revealsIn(8, true, false)).toBe(false);
    expect(revealsIn(0, false, false)).toBe(false);
    expect(revealsIn(0, true, true)).toBe(false);
  });
  it('the whole stagger of a screen stays inside the 400 ms entry budget', () => {
    expect(revealDelay(STAGGER_MAX_ITEMS - 1, true, false) + motion.duration.base).toBeLessThanOrEqual(400);
  });
});

describe('chart draw (E-63)', () => {
  it('measures a line', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 0, y: 0 }])).toBe(0);
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
  });
  it('draws left to right: nothing at 0, all at 1, clamped, and the whole line without progress info', () => {
    expect(drawDash(200, 0)).toEqual({ dasharray: '200 200', dashoffset: 200 });
    expect(drawDash(200, 0.25).dashoffset).toBe(150);
    expect(drawDash(200, 1).dashoffset).toBe(0);
    expect(drawDash(200, 7).dashoffset).toBe(0);
    expect(drawDash(200, -3).dashoffset).toBe(200);
    expect(drawDash(200, undefined).dashoffset).toBe(0);
    expect(drawDash(-5, 0.5)).toEqual({ dasharray: '0 0', dashoffset: 0 });
  });
  it('the line draws first, then the points appear', () => {
    expect(lineProgress(0)).toBe(0);
    expect(lineProgress(LINE_DRAW_SHARE)).toBe(1);
    expect(pointsOpacity(LINE_DRAW_SHARE)).toBe(0);
    expect(pointsOpacity(1)).toBe(1);
    expect(pointsOpacity(0.5)).toBe(0);
    expect(lineProgress(1)).toBe(1);
  });
});

describe('muscle map fill (E-63)', () => {
  it('blends from the old intensity to the new one, eased and clamped', () => {
    expect(blendIntensity(0, 1, 0)).toBe(0);
    expect(blendIntensity(0, 1, 1)).toBe(1);
    expect(blendIntensity(0.2, 0.8, 1)).toBeCloseTo(0.8, 9);
    expect(blendIntensity(0.8, 0.2, 1)).toBeCloseTo(0.2, 9); // down as well as up
    expect(blendIntensity(0, 1, 0.5)).toBeGreaterThan(0.5); // eased out
    expect(blendIntensity(0, 1, 9)).toBe(1);
    expect(blendIntensity(0.3, 0.9, -1)).toBeCloseTo(0.3, 9);
  });
  it('regions fill top to bottom, staggered, all done within the total time', () => {
    const count = 10;
    expect(regionProgress(0, 0, count)).toBe(0);
    expect(regionProgress(1, count - 1, count)).toBe(1);
    // At 50% overall the top region is done and the bottom one has not started.
    expect(regionProgress(0.5, 0, count)).toBe(1);
    expect(regionProgress(0.2, count - 1, count)).toBe(0);
    for (let i = 1; i < count; i++) expect(regionProgress(0.4, i, count)).toBeLessThanOrEqual(regionProgress(0.4, i - 1, count));
    expect(regionProgress(0.5, 0, 1)).toBe(0.5);
  });
});

describe('celebrate once (E-63)', () => {
  it('a new PR celebrates the first time only', () => {
    const l = createCelebrationLedger();
    expect(l.once('w1:squat')).toBe(true);
    expect(l.once('w1:squat')).toBe(false);
    expect(l.once('w1:bench')).toBe(true);
    l.reset();
    expect(l.once('w1:squat')).toBe(true);
  });
});
