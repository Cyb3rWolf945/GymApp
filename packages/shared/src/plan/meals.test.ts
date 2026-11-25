import { describe, expect, it } from 'vitest';
import type { NutritionPlan } from '../ai/schemas.ts';
import type { RecipeCandidate } from '../ai/prompts.ts';
import { applyMealSwaps, mealSwapCandidates, scaleIngredients } from './meals.ts';

const r = (slug: string, kcal: number, extra: Partial<RecipeCandidate> = {}): RecipeCandidate => ({
  slug, name: slug, diet: 'omnivore', kcal, protein_g: 1, carbs_g: 1, fat_g: 1, allergens: [], ...extra,
});
const profile = { diet: 'omnivore', allergens: [] } as const;

describe('mealSwapCandidates', () => {
  const lib = [r('cur', 500), r('a', 540), r('b', 460), r('far', 600), r('low', 440), r('nokcal', 0)];

  it('keeps recipes within ±10% of the slot kcal, closest first', () => {
    expect(mealSwapCandidates(lib[0], 1, lib, profile).map((x) => x.slug)).toEqual(['a', 'b']);
  });
  it('compares at the slot portions', () => {
    // slot = 500 × 2 = 1000 kcal; at 2 portions 'a' = 1080 (ok), 'far' = 1200 (out)
    expect(mealSwapCandidates(lib[0], 2, lib, profile).map((x) => x.slug)).toEqual(['a', 'b']);
  });
  it('drops allergens, diet misfits and excluded slugs', () => {
    const l = [r('cur', 500), r('nut', 500, { allergens: ['nuts'] }), r('meat', 500), r('veg', 505, { diet: 'vegan' }), r('ex', 500)];
    const got = mealSwapCandidates(l[0], 1, l, { diet: 'vegetarian', allergens: ['nuts'] }, ['ex']);
    expect(got.map((x) => x.slug)).toEqual(['veg']);
  });
  it('returns nothing without a known kcal', () => {
    expect(mealSwapCandidates({ slug: 'x', kcal: null }, 1, lib, profile)).toEqual([]);
  });
});

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
