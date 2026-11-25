import { describe, expect, it } from 'vitest';
import { detectPRs } from './e1rm';
import { nextPosition, prefillSet, volumeKg } from './session';
import {
  BARBELL_COMPOUNDS, DEFAULT_BAR, defaultPlateConfig, firstBarbellCompound, fromUnit, nearestLoadable, normalizePlateConfig, platesPerSide, roundToLoadable, toUnit, warmupSets,
} from './plates';

const kg = defaultPlateConfig('kg');
const lb = defaultPlateConfig('lb');
const stacks = (w: number, cfg = kg) => {
  const r = platesPerSide(w, cfg);
  return r.ok ? r.perSide.map((s) => `${s.count}×${s.plate}`).join(' + ') : r.reason;
};

describe('platesPerSide (kg)', () => {
  it('shows the plates per side with the fewest plates', () => {
    expect(stacks(100)).toBe('1×25 + 1×15');
    expect(stacks(60)).toBe('1×20');
    expect(stacks(142.5)).toBe('2×25 + 1×10 + 1×1.25');
    expect(stacks(102.5)).toBe('1×25 + 1×15 + 1×1.25');
    expect(stacks(180)).toBe('3×25 + 1×5');
  });
  it('the empty bar needs no plates', () => {
    const r = platesPerSide(20, kg);
    expect(r).toMatchObject({ ok: true, barOnly: true, perSide: [] });
  });
  it('refuses weights below the bar, and says where the bar starts', () => {
    expect(platesPerSide(15, kg)).toEqual({ ok: false, reason: 'below_bar', nearest: { lower: null, higher: 20 } });
  });
  it('refuses weights the plates cannot make, with the closest ones', () => {
    expect(platesPerSide(21, kg)).toEqual({ ok: false, reason: 'not_loadable', nearest: { lower: 20, higher: 22.5 } });
    expect(platesPerSide(101, kg)).toMatchObject({ ok: false, reason: 'not_loadable', nearest: { lower: 100, higher: 102.5 } });
  });
  it('refuses nonsense', () => {
    for (const w of [0, -5, NaN, Infinity]) expect(platesPerSide(w, kg)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(platesPerSide(100, { ...kg, plates: [] })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(platesPerSide(100, { ...kg, bar: 0 })).toMatchObject({ ok: false, reason: 'invalid' });
  });
  it('uses only the plates the gym has and a different bar', () => {
    const home = { unit: 'kg' as const, bar: 15, plates: [10, 5, 2.5] };
    expect(stacks(60, home)).toBe('2×10 + 1×2.5');
    expect(platesPerSide(65, { ...home, plates: [10] })).toMatchObject({ ok: false, reason: 'not_loadable' });
    expect(stacks(100, { ...kg, plates: [20, 10] })).toBe('2×20');
  });
  it('finds exact stacks that a greedy pick would miss', () => {
    // 3 + 2 per side: greedy takes 3 then fails on 3? plates 3 and 2: 4 = 2+2, not 3+...
    expect(stacks(28, { unit: 'kg', bar: 20, plates: [3, 2] })).toBe('2×2');
  });
});

describe('platesPerSide (lb)', () => {
  it('uses 45 lb bar and lb plates', () => {
    expect(DEFAULT_BAR.lb).toBe(45);
    expect(stacks(135, lb)).toBe('1×45');
    expect(stacks(225, lb)).toBe('2×45');
    expect(stacks(185, lb)).toBe('1×45 + 1×25');
    expect(stacks(155, lb)).toBe('1×45 + 1×10');
  });
  it('knows what it cannot load', () => {
    expect(platesPerSide(136, lb)).toMatchObject({ ok: false, reason: 'not_loadable', nearest: { lower: 135, higher: 140 } });
    expect(platesPerSide(40, lb)).toMatchObject({ ok: false, reason: 'below_bar' });
  });
  it('converts kg (as stored) to lb and back', () => {
    expect(toUnit(100, 'lb')).toBe(220.46);
    expect(toUnit(100, 'kg')).toBe(100);
    expect(fromUnit(225, 'lb')).toBe(102.06);
    expect(fromUnit(toUnit(80, 'lb'), 'lb')).toBeCloseTo(80, 1);
  });
});

describe('nearestLoadable and roundToLoadable', () => {
  it('rounds to the closest loadable weight, ties down, never below the bar', () => {
    expect(roundToLoadable(41, kg)).toBe(40);
    expect(roundToLoadable(41.3, kg)).toBe(42.5);
    expect(roundToLoadable(21.25, kg)).toBe(20);
    expect(roundToLoadable(5, kg)).toBe(20);
    expect(roundToLoadable(NaN, kg)).toBe(20);
    expect(roundToLoadable(100, kg)).toBe(100);
  });
  it('has no lower neighbour under the bar', () => {
    expect(nearestLoadable(20.5, kg).lower).toBe(20);
    expect(nearestLoadable(10, kg)).toEqual({ lower: null, higher: 20 });
  });
});

describe('normalizePlateConfig', () => {
  it('keeps good settings and repairs bad ones', () => {
    expect(normalizePlateConfig({ bar: 15, plates: [5, 10, 10, -2, 0, NaN] }, 'kg')).toEqual({ unit: 'kg', bar: 15, plates: [10, 5] });
    expect(normalizePlateConfig({ bar: 500, plates: [] }, 'kg')).toEqual(kg);
    expect(normalizePlateConfig(null, 'lb')).toEqual(lb);
    expect(normalizePlateConfig({ bar: 100 }, 'lb').bar).toBe(45); // out of the allowed range
  });
});

describe('warmupSets', () => {
  it('bar × 10, 40% × 5, 60% × 3, 80% × 2 of a 100 kg working weight', () => {
    expect(warmupSets(100, kg).map((s) => [s.weight, s.reps])).toEqual([[20, 10], [40, 5], [60, 3], [80, 2]]);
  });
  it('rounds every set to a weight you can load', () => {
    const sets = warmupSets(107.5, kg);
    for (const s of sets) expect(platesPerSide(s.weight, kg).ok).toBe(true);
    expect(sets.map((s) => s.weight)).toEqual([20, 42.5, 65, 85]);
  });
  it('drops steps that land on the bar, repeat, or reach the working weight', () => {
    expect(warmupSets(40, kg).map((s) => s.weight)).toEqual([20, 25, 32.5]); // 40% lands on the bar and is dropped
    expect(warmupSets(25, kg).map((s) => s.weight)).toEqual([20]);
    expect(warmupSets(20, kg)).toEqual([]);
    expect(warmupSets(15, kg)).toEqual([]);
  });
  it('is empty for impossible weights', () => {
    for (const w of [0, -10, NaN, Infinity]) expect(warmupSets(w, kg)).toEqual([]);
  });
  it('works in lb: weights in lb, stored in kg', () => {
    const sets = warmupSets(fromUnit(225, 'lb'), lb);
    expect(sets.map((s) => s.weight)).toEqual([45, 90, 135, 180]);
    expect(sets[2].weightKg).toBe(fromUnit(135, 'lb'));
    expect(sets[0].reps).toBe(10);
  });
  it('picks the first barbell compound lift of the workout', () => {
    expect(firstBarbellCompound(['dumbbell-fly', 'barbell-bench-press', 'barbell-back-squat'])).toBe('barbell-bench-press');
    expect(firstBarbellCompound(['dumbbell-fly', 'barbell-curl'])).toBeNull();
    expect(BARBELL_COMPOUNDS.has('barbell-curl')).toBe(false);
  });
});

describe('warm-up sets are not part of the work', () => {
  const work = { slug: 'barbell-back-squat', weightKg: 100, reps: 5 };
  const warm = { slug: 'barbell-back-squat', weightKg: 60, reps: 3, warmup: true };
  it('are left out of volume', () => {
    expect(volumeKg([warm, work])).toBe(500);
  });
  it('can never be a PR', () => {
    const heavyWarm = { ...warm, weightKg: 300, reps: 5 };
    expect(detectPRs([heavyWarm], new Map([['barbell-back-squat', 100]]))).toEqual([]);
    expect(detectPRs([heavyWarm, work], new Map([['barbell-back-squat', 100]]))).toHaveLength(1);
  });
  it('do not use up the planned sets, and do not set the next prefill', () => {
    const planned = [{ slug: 'barbell-back-squat', name: 'Squat', sets: 3, repsMin: 5, repsMax: 5, restSeconds: 120 }];
    expect(nextPosition(planned, [warm, warm, warm])).toEqual({ exercise: 0, set: 0 });
    expect(nextPosition(planned, [warm, work])).toEqual({ exercise: 0, set: 1 });
    expect(prefillSet(planned[0], [warm], { weightKg: 100, reps: 5 })).toEqual({ weightKg: 100, reps: 5 });
    expect(prefillSet(planned[0], [warm, work], undefined)).toEqual({ weightKg: 100, reps: 5 });
  });
});
