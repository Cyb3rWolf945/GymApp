import { describe, expect, it } from 'vitest';
import type { NutritionPlan } from '../ai/schemas.ts';
import { applyMealSwaps, scaleIngredients } from './meals.ts';

describe('applyMealSwaps', () => {
  const plan = {
    rationale: 'x',
    days: [{ dayType: 'training', kcal: 1000, proteinG: 1, carbsG: 1, fatG: 1, meals: [{ name: 'Lunch', recipeSlug: 'a', portions: 1 }, { name: 'Dinner', recipeSlug: 'b', portions: 1 }] }],
  } as NutritionPlan;
  const row = (meal_index: number, from_slug: string, to_slug: string, created_at: string) => ({ day_index: 0, meal_index, from_slug, to_slug, created_at });

  it('applies chains oldest first, ignores stale rows, and does not mutate the plan', () => {
    const out = applyMealSwaps(plan, [row(0, 'c', 'd', '3'), row(0, 'a', 'c', '1'), row(1, 'zzz', 'q', '2'), row(9, 'a', 'q', '4')]);
    expect(out.days[0].meals.map((m) => m.recipeSlug)).toEqual(['d', 'b']);
    expect(plan.days[0].meals[0].recipeSlug).toBe('a');
  });
});

describe('scaleIngredients', () => {
  it('scales grams by portions per serving', () => {
    expect(scaleIngredients([{ grams: 400 }, { grams: 90 }], 2, 1.5).map((x) => x.scaledGrams)).toEqual([300, 68]);
  });
});
