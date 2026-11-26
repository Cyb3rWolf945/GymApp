import { describe, expect, it } from 'vitest';
import { macroShares, mealKind } from './index';

describe('macroShares', () => {
  it('splits the calories by 4/4/9 kcal per gram and adds up to 1', () => {
    const s = macroShares(150, 250, 60); // 600 + 1000 + 540 kcal
    expect(s.protein).toBeCloseTo(600 / 2140, 6);
    expect(s.carbs).toBeCloseTo(1000 / 2140, 6);
    expect(s.fat).toBeCloseTo(540 / 2140, 6);
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(1, 9);
  });
  it('is all zero for an empty or invalid day, never NaN', () => {
    expect(macroShares(0, 0, 0)).toEqual({ protein: 0, carbs: 0, fat: 0 });
    expect(macroShares(-5, -5, -5)).toEqual({ protein: 0, carbs: 0, fat: 0 });
    expect(macroShares(Number.NaN, 0, 0)).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
  it('a single macro takes the whole ring', () => {
    expect(macroShares(0, 0, 30)).toEqual({ protein: 0, carbs: 0, fat: 1 });
  });
});

describe('mealKind', () => {
  it.each([
    ['Breakfast', 'breakfast'], ['Brunch', 'breakfast'], ['Lunch', 'lunch'], ['Dinner', 'dinner'], ['Supper', 'dinner'],
    ['Snack', 'snack'], ['Snack 2', 'snack'], ['Pre-workout', 'snack'], ['Post workout shake', 'snack'],
    ['Meal 3', 'other'], ['', 'other'],
  ])('%s is %s', (name, kind) => expect(mealKind(name)).toBe(kind));
});
