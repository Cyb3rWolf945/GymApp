import type { NutritionPlan } from '../ai/schemas.ts';
import { INGREDIENT_CATEGORIES } from '../catalog/index.ts';

export interface ShoppingRecipe {
  /** Stored grams are for the whole recipe, i.e. `servings` servings. */
  servings: number;
  ingredients: { name: string; category: string | null; grams: number }[];
}

export interface ShoppingItem {
  /** Stable key across regenerations: the ingredient name. */
  label: string;
  grams: number;
  quantity: string;
}
export interface ShoppingGroup {
  category: string;
  items: ShoppingItem[];
}

/** 12 → "10 g", 1240 → "1.25 kg". Grams round to 5; from 1 kg up the unit is kg. */
export function formatQuantity(grams: number): string {
  if (grams >= 1000) return `${Number((Math.round(grams / 10) / 100).toFixed(2))} kg`;
  return `${Math.max(5, Math.round(grams / 5) * 5)} g`;
}

const categoryRank = (c: string) => {
  const i = (INGREDIENT_CATEGORIES as readonly string[]).indexOf(c);
  return i < 0 ? INGREDIENT_CATEGORIES.length : i;
};
export const OTHER_CATEGORY = 'other';

/**
 * Week's ingredients: each nutrition day counts once per weekday of its type, each meal is scaled by its
 * portions, quantities of the same ingredient are summed, and items are grouped by category.
 */
export function buildShoppingList(
  plan: NutritionPlan,
  weekdays: { training: number; rest: number },
  recipes: ReadonlyMap<string, ShoppingRecipe>,
): ShoppingGroup[] {
  const totals = new Map<string, { category: string; grams: number }>();
  for (const day of plan.days) {
    const times = weekdays[day.dayType];
    if (times <= 0) continue;
    for (const meal of day.meals) {
      const recipe = recipes.get(meal.recipeSlug);
      if (!recipe) continue;
      const factor = (meal.portions / Math.max(1, recipe.servings)) * times;
      for (const ing of recipe.ingredients) {
        const prev = totals.get(ing.name);
        const grams = (prev?.grams ?? 0) + ing.grams * factor;
        totals.set(ing.name, { category: prev?.category ?? ing.category ?? OTHER_CATEGORY, grams });
      }
    }
  }
  const groups = new Map<string, ShoppingItem[]>();
  for (const [label, { category, grams }] of totals) {
    groups.set(category, [...(groups.get(category) ?? []), { label, grams, quantity: formatQuantity(grams) }]);
  }
  return [...groups.entries()]
    .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, items]) => ({ category, items: items.sort((a, b) => a.label.localeCompare(b.label)) }));
}

/** Only labels still on the list count as checked: stale rows from an older plan are ignored. */
export function activeChecked(groups: readonly ShoppingGroup[], checkedLabels: Iterable<string>): Set<string> {
  const onList = new Set(groups.flatMap((g) => g.items.map((i) => i.label)));
  return new Set([...checkedLabels].filter((l) => onList.has(l)));
}
