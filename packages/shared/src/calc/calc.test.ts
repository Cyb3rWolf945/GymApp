import { describe, expect, it } from 'vitest';
import {
  CalcError, bmr, tdee, calorieTarget, macros, trainingRestSplit,
  lbToKg, kgToLb, inToCm, cmToIn, ftInToCm, cmToFtIn, type Profile,
} from './index';

const male: Profile = { sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'moderate' };
const female: Profile = { sex: 'female', age: 30, weightKg: 60, heightCm: 165, activity: 'light' };

describe('bmr / tdee', () => {
  it('male Mifflin-St Jeor', () => expect(bmr(male)).toBe(1780));
  it('female Mifflin-St Jeor', () => expect(bmr(female)).toBe(1320.25));
  it('tdee applies activity multiplier', () => expect(tdee(male)).toBeCloseTo(1780 * 1.55, 5));
  it('rejects invalid input', () => {
    expect(() => bmr({ ...male, age: 5 })).toThrow(CalcError);
    expect(() => bmr({ ...male, weightKg: NaN })).toThrow(CalcError);
    expect(() => bmr({ ...male, heightCm: 20 })).toThrow(CalcError);
  });
});

describe('calorieTarget', () => {
  it('recomp = maintenance', () => {
    const t = calorieTarget(male, { type: 'recomp' });
    expect(t.kcal).toBe(Math.round(tdee(male)));
    expect(t.adjustment).toBe(0);
  });
  it('bulk adds 10%', () => {
    expect(calorieTarget(male, { type: 'bulk' }).kcal).toBe(Math.round(tdee(male) * 1.1));
  });
  it('slow < moderate < aggressive deficits', () => {
    const k = (pace: 'slow' | 'moderate' | 'aggressive') => calorieTarget(male, { type: 'cut', pace }).kcal;
    expect(k('slow')).toBeGreaterThan(k('moderate'));
    expect(k('moderate')).toBeGreaterThan(k('aggressive'));
  });
  it('moderate cut ≈ 550 kcal deficit', () => {
    expect(calorieTarget(male, { type: 'cut', pace: 'moderate' }).adjustment).toBe(-550);
  });
  it('caps deficit at 25% of TDEE', () => {
    const small: Profile = { ...female, activity: 'sedentary', weightKg: 55 };
    const t = calorieTarget(small, { type: 'cut', pace: 'aggressive' });
    expect(t.capped).toBe(true);
    expect(t.adjustment).toBeGreaterThanOrEqual(-Math.round(t.tdee * 0.25) - 1);
  });
  it('enforces kcal floor for women (1200)', () => {
    const tiny: Profile = { sex: 'female', age: 60, weightKg: 40, heightCm: 150, activity: 'sedentary' };
    const t = calorieTarget(tiny, { type: 'cut', pace: 'slow' });
    expect(t.kcal).toBe(1200);
    expect(t.capped).toBe(true);
  });
  it('enforces kcal floor for men (1500)', () => {
    const tiny: Profile = { sex: 'male', age: 70, weightKg: 45, heightCm: 150, activity: 'sedentary' };
    expect(calorieTarget(tiny, { type: 'cut', pace: 'slow' }).kcal).toBe(1500);
  });
  it('refuses aggressive cut for flagged profiles', () => {
    const flagged: Profile = { ...male, flags: ['eating_disorder_history'] };
    expect(() => calorieTarget(flagged, { type: 'cut', pace: 'aggressive' })).toThrow(
      expect.objectContaining({ code: 'AGGRESSIVE_CUT_REFUSED' }),
    );
  });
  it('allows moderate cut for flagged profiles', () => {
    expect(() => calorieTarget({ ...male, flags: ['under_18'] }, { type: 'cut', pace: 'moderate' })).not.toThrow();
  });
});

describe('macros', () => {
  it('protein within 1.6–2.2 g/kg and calories add up', () => {
    const m = macros(2500, 80, 'recomp');
    expect(m.proteinG / 80).toBeGreaterThanOrEqual(1.6);
    expect(m.proteinG / 80).toBeLessThanOrEqual(2.2);
    const total = m.proteinG * 4 + m.fatG * 9 + m.carbsG * 4;
    expect(Math.abs(total - 2500)).toBeLessThan(10);
  });
  it('clamps custom protein to bounds', () => {
    expect(macros(2500, 80, 'cut', 5).proteinG).toBe(176);
    expect(macros(2500, 80, 'cut', 0.5).proteinG).toBe(128);
  });
  it('fat floor is the larger of 0.6 g/kg and 20% kcal', () => {
    expect(macros(1500, 100, 'cut').fatG).toBe(60); // 0.6*100 > 33
    expect(macros(3000, 60, 'bulk').fatG).toBe(67); // 20% of 3000 / 9
  });
  it('carbs never negative at very low kcal', () => {
    const m = macros(1200, 120, 'cut');
    expect(m.carbsG).toBe(0);
    expect(m.proteinG).toBeGreaterThanOrEqual(192);
  });
  it('rejects non-positive input', () => {
    expect(() => macros(0, 80, 'cut')).toThrow(CalcError);
  });
});

describe('trainingRestSplit', () => {
  it('weekly kcal preserved (±rounding)', () => {
    const s = trainingRestSplit(2500, 80, 'recomp', 4, 'male');
    const weekly = s.training.kcal * 4 + s.rest.kcal * 3;
    expect(Math.abs(weekly - 2500 * 7)).toBeLessThanOrEqual(4);
    expect(s.training.kcal).toBeGreaterThan(s.rest.kcal);
  });
  it('protein and fat constant, carbs differ', () => {
    const s = trainingRestSplit(2500, 80, 'recomp', 3, 'male');
    expect(s.training.proteinG).toBe(s.rest.proteinG);
    expect(s.training.fatG).toBe(s.rest.fatG);
    expect(s.training.carbsG).toBeGreaterThan(s.rest.carbsG);
  });
  it('0 or 7 training days → identical days', () => {
    expect(trainingRestSplit(2500, 80, 'cut', 0, 'male').rest).toEqual(trainingRestSplit(2500, 80, 'cut', 0, 'male').training);
    const s = trainingRestSplit(2500, 80, 'cut', 7, 'male');
    expect(s.rest).toEqual(s.training);
  });
  it('rest day respects kcal floor', () => {
    const s = trainingRestSplit(1520, 70, 'cut', 6, 'male');
    expect(s.rest.kcal).toBeGreaterThanOrEqual(1500);
  });
  it('rejects bad training days', () => {
    expect(() => trainingRestSplit(2500, 80, 'cut', 8, 'male')).toThrow(CalcError);
    expect(() => trainingRestSplit(2500, 80, 'cut', 2.5, 'male')).toThrow(CalcError);
  });
});

describe('units', () => {
  it('lb ↔ kg', () => {
    expect(lbToKg(220)).toBeCloseTo(99.79, 2);
    expect(kgToLb(lbToKg(175))).toBeCloseTo(175, 8);
  });
  it('in ↔ cm', () => {
    expect(inToCm(10)).toBe(25.4);
    expect(cmToIn(inToCm(70))).toBeCloseTo(70, 8);
  });
  it('ft/in ↔ cm', () => {
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 5);
    expect(cmToFtIn(177.8)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFtIn(182.88)).toEqual({ feet: 6, inches: 0 });
  });
});
