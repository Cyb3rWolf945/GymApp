import type { NutritionPlan } from '../ai/schemas.ts';
import type { RecipeCandidate } from '../ai/prompts.ts';
import { recipeProblems } from '../ai/validator.ts';
import type { Allergen, Diet } from '../catalog/index.ts';

/** A swapped meal must stay within this share of the slot's kcal. */
export const MEAL_SWAP_KCAL_TOLERANCE = 0.1;
const MAX_OPTIONS = 8;

export interface MealSwapRow {
  day_index: number;
  meal_index: number;
  from_slug: string;
  to_slug: string;
  created_at: string;
}

/**
 * Deterministic alternatives for one meal slot (no LLM): same portions, kcal within ±10% of the slot,
 * respecting the user's allergens and diet. Closest kcal first, then name.
 */
export function mealSwapCandidates(
  current: { slug: string; kcal: number | null },
  portions: number,
  library: readonly RecipeCandidate[],
  profile: { diet: Diet; allergens: readonly Allergen[] },
  exclude: readonly string[] = [],
): RecipeCandidate[] {
  const slot = (current.kcal ?? 0) * portions;
  if (slot <= 0) return [];
  const inputs = { diet: profile.diet, allergens: [...profile.allergens] } as Parameters<typeof recipeProblems>[1];
  return library
    .filter((r) => r.slug !== current.slug && !exclude.includes(r.slug) && (r.kcal ?? 0) > 0)
    .filter((r) => Math.abs(r.kcal! * portions - slot) <= slot * MEAL_SWAP_KCAL_TOLERANCE)
    .filter((r) => recipeProblems(r, inputs).length === 0)
    .sort((a, b) => Math.abs(a.kcal! - (current.kcal ?? 0)) - Math.abs(b.kcal! - (current.kcal ?? 0)) || a.name.localeCompare(b.name))
    .slice(0, MAX_OPTIONS);
}

/** Apply swaps on top of the generated plan, oldest first. A swap applies only if the slot still holds `from_slug`. */
export function applyMealSwaps(plan: NutritionPlan, swaps: readonly MealSwapRow[]): NutritionPlan {
  const days = plan.days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m })) }));
  for (const s of [...swaps].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const meal = days[s.day_index]?.meals[s.meal_index];
    if (meal && meal.recipeSlug === s.from_slug) meal.recipeSlug = s.to_slug;
  }
  return { ...plan, days };
}

/** Ingredient grams for the portions eaten. Stored grams are for the whole recipe (`servings` servings). */
export function scaleIngredients<T extends { grams: number }>(rows: readonly T[], servings: number, portions: number): (T & { scaledGrams: number })[] {
  const per = portions / Math.max(1, servings);
  return rows.map((r) => ({ ...r, scaledGrams: Math.round(r.grams * per) }));
}
