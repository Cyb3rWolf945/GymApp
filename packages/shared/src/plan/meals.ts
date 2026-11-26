import type { NutritionPlan } from '../ai/schemas.ts';

export interface MealSwapRow {
  id?: string;
  /** Set when the swap changed the portions (so the new meal keeps the slot's kcal). */
  portions?: number | null;
  day_index: number;
  meal_index: number;
  from_slug: string;
  to_slug: string;
  created_at: string;
}

/** Apply swaps on top of the generated plan, oldest first. A swap applies only if the slot still holds `from_slug`. */
export function applyMealSwaps(plan: NutritionPlan, swaps: readonly MealSwapRow[]): NutritionPlan {
  const days = plan.days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m })) }));
  for (const s of [...swaps].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const meal = days[s.day_index]?.meals[s.meal_index];
    if (meal && meal.recipeSlug === s.from_slug) {
      meal.recipeSlug = s.to_slug;
      if (s.portions && s.portions > 0) meal.portions = s.portions;
    }
  }
  return { ...plan, days };
}

/** Ingredient grams for the portions eaten. Stored grams are for the whole recipe (`servings` servings). */
export function scaleIngredients<T extends { grams: number }>(rows: readonly T[], servings: number, portions: number): (T & { scaledGrams: number })[] {
  const per = portions / Math.max(1, servings);
  return rows.map((r) => ({ ...r, scaledGrams: Math.round(r.grams * per) }));
}
