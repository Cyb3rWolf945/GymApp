/** What the macro ring and the meal art are drawn from. Pure, so they can be tested without a screen. */

export interface MacroShares {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * The share of the calories each macro gives (protein and carbs 4 kcal a gram, fat 9), as fractions that add up to 1.
 * All zero when there is nothing to show, so a ring for an empty day draws nothing instead of NaN.
 */
export function macroShares(proteinG: number, carbsG: number, fatG: number): MacroShares {
  const p = Math.max(0, proteinG) * 4;
  const c = Math.max(0, carbsG) * 4;
  const f = Math.max(0, fatG) * 9;
  const total = p + c + f;
  if (!(total > 0)) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / total, carbs: c / total, fat: f / total };
}

export const MEAL_KINDS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
export type MealKind = (typeof MEAL_KINDS)[number];

const MEAL_RULES: readonly [MealKind, RegExp][] = [
  ['breakfast', /\bbreakfast\b|\bbrunch\b/i],
  ['lunch', /\blunch\b/i],
  ['dinner', /\bdinner\b|\bsupper\b/i],
  ['snack', /\bsnacks?\b|\bpre[\s-]?workout\b|\bpost[\s-]?workout\b|\bshake\b/i],
];

/** The kind of meal a slot is, from its name ("Breakfast", "Snack 2"). Unknown names are `other`, never an error. */
export function mealKind(slotName: string): MealKind {
  for (const [kind, re] of MEAL_RULES) if (re.test(slotName)) return kind;
  return 'other';
}
