import type { RecipeCandidate } from '../ai/prompts.ts';
import { recipeDislikes } from '../ai/dislikes.ts';
import { recipeProblems } from '../ai/validator.ts';
import type { Allergen, Diet } from '../catalog/index.ts';
import { mealKind } from './nutritionArt.ts';

/** An option must land within this share of the slot's kcal (after adjusting the portions). */
export const MEAL_OPTION_KCAL_TOLERANCE = 0.1;
export const MIN_PORTIONS = 0.5;
export const MAX_PORTIONS = 3;
/** Alternatives shown on the meal card, and the most the "See more" sheet lists. */
export const INLINE_OPTIONS = 3;
export const MAX_OPTIONS = 8;

/**
 * The narrowest an option card can be before its text breaks badly: a recipe name and a "540 kcal · 38 g protein · 15 min"
 * line need about this much room.
 */
export const MIN_OPTION_CARD_WIDTH = 150;
/** `equal`: cards share the row in equal columns. `scroll`: fixed-width cards in a row you scroll, as on a phone. */
export type OptionRowLayout = 'equal' | 'scroll';

/**
 * How to lay out `count` option cards in a container `containerWidth` wide with `gap` between them: equal columns only when
 * every card then gets at least `minCard` px, otherwise a scrolling row. The container is the column the cards sit in, not
 * the screen (between 600 and about 1000 px the meals column is much narrower than the screen). An unmeasured container
 * (0) or no cards give `scroll`.
 */
export function optionRowLayout(containerWidth: number, count: number, gap: number, minCard = MIN_OPTION_CARD_WIDTH): OptionRowLayout {
  if (!(containerWidth > 0) || count < 1) return 'scroll';
  const each = (containerWidth - gap * (count - 1)) / count;
  return each >= minCard ? 'equal' : 'scroll';
}

export interface MealOptionsProfile {
  diet: Diet;
  allergens: readonly Allergen[];
  dislikes?: readonly string[];
  /** The longest the user wants to cook (minutes). */
  cookingMinutes?: number;
  budget?: 'low' | 'medium' | 'high';
}

export interface MealOption {
  recipe: RecipeCandidate;
  /** In 0.5 steps, chosen so the option's kcal match the slot. */
  portions: number;
  kcal: number;
  proteinG: number;
}

export interface MealOptionsInput {
  /** The meal now in the slot. */
  current: { slug: string; kcal: number | null; portions: number; proteinG?: number | null };
  /** The slot's name ("Breakfast", "Meal 2"): decides which recipes fit. Unknown names fit any recipe. */
  slotName: string;
  library: readonly RecipeCandidate[];
  profile: MealOptionsProfile;
  /** Recipes already in the other slots of that day. */
  usedInDay?: readonly string[];
  /** Recipes the user swapped away from before. */
  swappedAway?: readonly string[];
  /** Facts from memory ("doesn't like ..."), matched against ingredient names. */
  dislikeFacts?: readonly string[];
  /** Breaks ties the same way every time for one user. */
  seed?: string;
  limit?: number;
}

const BUDGET_RANK = { low: 0, medium: 1, high: 2 } as const;

/** Small, stable string hash (0 to 1). */
export function seededUnit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/** The portions (0.5 steps) that bring `kcal` closest to `slotKcal`, or null when none lands within the tolerance. */
export function portionsFor(kcal: number, slotKcal: number): number | null {
  if (!(kcal > 0) || !(slotKcal > 0)) return null;
  const steps = Math.round(slotKcal / kcal / MIN_PORTIONS);
  const p = Math.min(MAX_PORTIONS, Math.max(MIN_PORTIONS, steps * MIN_PORTIONS));
  return Math.abs(kcal * p - slotKcal) <= slotKcal * MEAL_OPTION_KCAL_TOLERANCE ? p : null;
}

const fitsSlot = (r: RecipeCandidate, kind: ReturnType<typeof mealKind>): boolean =>
  kind === 'other' || !r.meal_types || r.meal_types.length === 0 || r.meal_types.includes(kind);

/**
 * Ranked alternatives for one meal slot (no LLM), the same function for Today and Nutrition.
 * - Never relaxed: allergens and diet.
 * - Must fit the slot: the recipe's `meal_types` include the slot's kind (unknown slot names fit anything).
 * - Soft, dropped only to avoid showing too few: dislikes, cooking time, budget, recipes swapped away before.
 * - Excluded: the current recipe and the recipes already in other slots that day.
 * - Portions are adjusted in 0.5 steps so each option is within ±10% of the slot's kcal.
 * - Order: soft filters respected first, then closest macros, then variety (a different main ingredient), then the seed.
 * Too few fits means fewer options, never an invalid one.
 */
export function mealOptions(input: MealOptionsInput): MealOption[] {
  const { current, library, profile } = input;
  const slotKcal = (current.kcal ?? 0) * current.portions;
  if (slotKcal <= 0) return [];
  const kind = mealKind(input.slotName);
  const inputs = { diet: profile.diet, allergens: [...profile.allergens] } as Parameters<typeof recipeProblems>[1];
  const taken = new Set([current.slug, ...(input.usedInDay ?? [])]);
  const away = new Set(input.swappedAway ?? []);
  const mainOf = (slug: string) => library.find((r) => r.slug === slug)?.ingredients?.[0]?.toLowerCase();
  const currentMain = mainOf(current.slug);
  const currentProtein = (current.proteinG ?? 0) * current.portions;

  const fits: { option: MealOption; soft: number; sort: [number, number, number] }[] = [];
  for (const r of library) {
    if (taken.has(r.slug) || !((r.kcal ?? 0) > 0) || !fitsSlot(r, kind)) continue;
    if (recipeProblems(r, inputs).length > 0) continue; // allergens and diet, never relaxed
    const portions = portionsFor(r.kcal!, slotKcal);
    if (portions === null) continue;
    let soft = 0;
    if ((profile.dislikes?.length ?? 0) > 0 && recipeDislikes(r.ingredients ?? [], profile.dislikes ?? []).length > 0) soft++;
    if (input.dislikeFacts && input.dislikeFacts.length > 0 && (r.ingredients ?? []).some((n) => input.dislikeFacts!.some((f) => f.toLowerCase().includes(n.toLowerCase())))) soft++;
    if (profile.cookingMinutes && (r.prep_minutes ?? 0) > profile.cookingMinutes) soft++;
    if (profile.budget && r.cost_tier && BUDGET_RANK[r.cost_tier as keyof typeof BUDGET_RANK] > BUDGET_RANK[profile.budget]) soft++;
    if (away.has(r.slug)) soft++;
    const kcal = r.kcal! * portions;
    const proteinG = (r.protein_g ?? 0) * portions;
    const sameMain = currentMain && r.ingredients?.[0]?.toLowerCase() === currentMain ? 1 : 0;
    const macroGap = Math.abs(kcal - slotKcal) / slotKcal + (currentProtein > 0 ? Math.abs(proteinG - currentProtein) / currentProtein : 0) * 0.5;
    fits.push({ option: { recipe: r, portions, kcal: Math.round(kcal), proteinG: Math.round(proteinG * 10) / 10 }, soft, sort: [macroGap, sameMain, seededUnit(`${input.seed ?? ''}:${r.slug}`)] });
  }
  const limit = input.limit ?? MAX_OPTIONS;
  const ordered = (list: typeof fits) =>
    [...list].sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2] || a.option.recipe.name.localeCompare(b.option.recipe.name));
  const clean = ordered(fits.filter((f) => f.soft === 0));
  // Soft filters are given up one level at a time, only to fill the list.
  const rest = [...fits.filter((f) => f.soft > 0)].sort((a, b) => a.soft - b.soft);
  const out = [...clean];
  for (const f of rest) if (out.length < Math.min(limit, INLINE_OPTIONS)) out.push(f);
  return out.slice(0, limit).map((f) => f.option);
}

/** The slot's meal after an undo: the swap row is dropped, so applying the rest of the swaps gives the previous meal. */
export const withoutSwap = <T extends { id?: string }>(swaps: readonly T[], id: string): T[] => swaps.filter((s) => s.id !== id);

/** Choosing another meal clears "eaten" for that slot. Returns the new list and whether something was cleared. */
export function clearEatenSlot(eaten: readonly number[], slot: number): { eaten: number[]; cleared: boolean } {
  return { eaten: eaten.filter((i) => i !== slot), cleared: eaten.includes(slot) };
}
