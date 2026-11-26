import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DISLIKE_OPTIONS } from '../onboarding/schema';
import { buildNutritionTemplate, mealSlots } from '../ai/mealTemplate';
import { recipeDislikes } from '../ai/dislikes';
import { buildPlanInputs } from '../ai/generate';
import type { RecipeCandidate } from '../ai/prompts';
import { NutritionPlanSchema } from '../ai/schemas';
import { validateNutrition } from '../ai/validator';
import { applySeed, createDb } from './harness';

// E-66: the template meal plan against the real recipe library (seed + migrations in PGlite).
let db: PGlite;
const DIETS = ['omnivore', 'vegetarian', 'vegan'] as const;

async function candidates(allergens: string[], diet: string): Promise<RecipeCandidate[]> {
  const { rows } = await db.query<Record<string, unknown>>(`select * from public.candidate_recipes($1::text[], $2)`, [allergens, diet]);
  return rows.map((r) => ({
    slug: r.slug as string, name: r.name as string, diet: r.diet as string,
    kcal: Number(r.kcal), protein_g: Number(r.protein_g), carbs_g: Number(r.carbs_g), fat_g: Number(r.fat_g),
    allergens: r.allergens as string[], meal_types: r.meal_types as string[], prep_minutes: Number(r.prep_minutes), cost_tier: r.cost_tier as string, ingredients: r.ingredients as string[],
  }));
}

const row = (goalType: string, o: Record<string, unknown>) => ({
  sex: 'male', birth_date: '1994-03-01', height_cm: 180, weight_kg: 80, experience: 'intermediate',
  onboarding: { goalType, daysPerWeek: 4, sessionMinutes: 60, equipment: ['full_gym'], activity: 'moderate', ...o },
});

beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
}, 60_000);
afterAll(() => db.close());

describe('recipe tags (seed)', () => {
  it('every recipe has meal types, a prep time and a cost tier', async () => {
    const { rows } = await db.query<{ slug: string; meal_types: string[]; prep_minutes: number; cost_tier: string }>(`select slug, meal_types, prep_minutes, cost_tier from public.recipes`);
    expect(rows).toHaveLength(60);
    for (const r of rows) {
      expect(r.meal_types.length, r.slug).toBeGreaterThanOrEqual(1);
      expect(r.meal_types.every((m) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(m)), r.slug).toBe(true);
      expect(r.prep_minutes, r.slug).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(r.cost_tier);
    }
  });
  it('the seed really tags them (not just the column defaults)', async () => {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int n from public.recipes where 'breakfast' = any(meal_types)`);
    expect(rows[0].n).toBeGreaterThanOrEqual(8);
  });
  it.each(DIETS)('%s has at least 2 recipes for every meal type', async (diet) => {
    const list = await candidates([], diet);
    for (const type of ['breakfast', 'lunch', 'dinner', 'snack']) expect(list.filter((r) => r.meal_types!.includes(type)).length, `${diet} ${type}`).toBeGreaterThanOrEqual(2);
  });
  it('dislikes map to real ingredients: each dislike that exists in the library matches a recipe, and nothing matches wrongly', async () => {
    const list = await candidates([], 'omnivore');
    const hits = (d: string) => list.filter((r) => recipeDislikes(r.ingredients!, [d]).length > 0).map((r) => r.slug);
    for (const d of ['mushrooms', 'fish', 'tofu', 'broccoli', 'onion', 'eggplant', 'spicy food']) expect(hits(d).length, d).toBeGreaterThan(0);
    expect(hits('mushrooms')).toContain('mushroom-risotto');
    expect(hits('fish')).toContain('salmon-quinoa-plate');
    expect(hits('fish')).not.toContain('shrimp-fried-rice'); // shrimp is shellfish, not "fish"
    expect(hits('olives')).toEqual([]); // olive oil is not olives
    expect(DISLIKE_OPTIONS.length).toBe(10);
  });
});

describe('the template meal plan passes the validator (every diet x 3 to 6 meals x allergens and dislikes x goal)', () => {
  const cases = DIETS.flatMap((diet) => [3, 4, 5, 6].flatMap((meals) => [false, true].flatMap((restricted) => ['cut', 'bulk', 'recomp'].map((goal) => ({ diet, meals, restricted, goal })))));
  it.each(cases)('$diet, $meals meals, restricted=$restricted, $goal', async ({ diet, meals, restricted, goal }) => {
    const allergens = restricted ? ['nuts', 'gluten'] : [];
    const dislikes = restricted ? ['mushrooms', 'fish', 'onion'] : [];
    const inputs = buildPlanInputs(row(goal, { diet, mealsPerDay: meals, allergens, dislikes, cookingMinutes: restricted ? 30 : undefined, budget: restricted ? 'medium' : undefined }) as never, new Date('2026-11-26'));
    const library = await candidates(allergens, diet);
    const { plan, relaxed } = buildNutritionTemplate(inputs, library, { seed: `user-${diet}-${meals}` });
    const errors = validateNutrition(plan, inputs, library);
    // Safety and shape are never negotiable: known recipes, no allergen, the right diet. (The validator words these as
    // "contains ..." / "does not fit ..." / "is not in the recipe library".)
    expect(errors.filter((e) => !/ is \d+, target is \d+/.test(e)), 'safety').toEqual([]);
    expect(NutritionPlanSchema.safeParse(plan).success).toBe(true);
    // Calories, protein, carbs and fat all inside the validator's tolerance wherever the library is big enough to allow it
    // (36 or more safe recipes). With the smallest libraries (vegan or vegetarian with allergens and dislikes) the plan is
    // the closest the recipes can get while keeping variety, so only the calories are held to the band.
    if (library.length >= 36) expect(errors, JSON.stringify(relaxed)).toEqual([]);
    else expect(errors.filter((e) => e.includes('kcal is')), JSON.stringify(relaxed)).toEqual([]);
    expect(plan.days.every((d) => d.meals.length === meals)).toBe(true);
    expect(plan.days[0].meals.map((m) => m.name)).toEqual(mealSlots(meals).map((s) => s.name));
    // Never an allergen, never the wrong diet.
    for (const d of plan.days) for (const m of d.meals) expect(library.find((r) => r.slug === m.recipeSlug)).toBeTruthy();
  });

  it('is fast: under 50 ms for the full library', async () => {
    const inputs = buildPlanInputs(row('recomp', { diet: 'omnivore', mealsPerDay: 6 }) as never, new Date('2026-11-26'));
    const library = await candidates([], 'omnivore');
    buildNutritionTemplate(inputs, library, { seed: 'warm' });
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) buildNutritionTemplate(inputs, library, { seed: `u${i}` });
    expect((performance.now() - t0) / 5).toBeLessThan(50);
  });
});
