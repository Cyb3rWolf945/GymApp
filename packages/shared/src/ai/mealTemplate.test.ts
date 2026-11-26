import { describe, expect, it } from 'vitest';
import { buildPlanInputs } from './generate';
import { TemplateError, buildNutritionTemplate, mealSlots, templateRationale } from './mealTemplate';
import type { PlanInputs, RecipeCandidate } from './prompts';
import { MACRO_TOLERANCE, nutritionDayTotals, recipeProblems, validateNutrition } from './validator';

// A synthetic library, big enough to be flexible: 12 breakfasts, 18 mains (lunch and dinner), 10 snacks.
const mk = (slug: string, meal: string[], o: Partial<RecipeCandidate> = {}, i = 0, scale = 1): RecipeCandidate => {
  // A spread of lean, carb-heavy and fatty recipes (different periods, so the macros do not move together).
  const protein = (25 + ((i * 7) % 31)) * scale;
  const carbs = (20 + ((i * 13) % 83)) * scale;
  const fat = (5 + ((i * 11) % 26)) * scale;
  return {
    slug, name: slug, diet: 'omnivore', allergens: [], meal_types: meal, prep_minutes: 20, cost_tier: 'medium', ingredients: ['Rice'],
    kcal: 4 * protein + 4 * carbs + 9 * fat, protein_g: protein, carbs_g: carbs, fat_g: fat, ...o,
  };
};
const lib = (): RecipeCandidate[] => [
  ...Array.from({ length: 12 }, (_, i) => mk(`b${i}`, ['breakfast'], {}, i)),
  ...Array.from({ length: 18 }, (_, i) => mk(`m${i}`, ['lunch', 'dinner'], {}, i + 3)),
  ...Array.from({ length: 10 }, (_, i) => mk(`s${i}`, ['snack'], {}, i, 0.45)),
];
const inputs = (o: Record<string, unknown> = {}, goal = 'recomp'): PlanInputs =>
  buildPlanInputs({ sex: 'male', birth_date: '1994-03-01', height_cm: 180, weight_kg: 80, experience: 'intermediate', onboarding: { goalType: goal, daysPerWeek: 4, sessionMinutes: 60, equipment: ['full_gym'], activity: 'moderate', mealsPerDay: 4, ...o } } as never, new Date('2026-11-26'));
const slugsOf = (r: { plan: { days: { meals: { recipeSlug: string }[] }[] } }) => r.plan.days.map((d) => d.meals.map((m) => m.recipeSlug));

describe('meal slots', () => {
  it('3 = breakfast, lunch, dinner; 4 adds a snack, 5 two, 6 three, with real names', () => {
    expect(mealSlots(3).map((s) => s.name)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(mealSlots(4).map((s) => s.name)).toEqual(['Breakfast', 'Lunch', 'Afternoon snack', 'Dinner']);
    expect(mealSlots(5).map((s) => s.name)).toEqual(['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner']);
    expect(mealSlots(6).map((s) => s.name)).toEqual(['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack']);
    for (const n of [3, 4, 5, 6]) {
      expect(mealSlots(n).reduce((t, s) => t + s.weight, 0)).toBeCloseTo(1, 9);
      expect(mealSlots(n).filter((s) => s.type === 'snack')).toHaveLength(n - 3);
    }
  });
  it('clamps odd values to 3 to 6', () => {
    expect(mealSlots(1)).toHaveLength(3);
    expect(mealSlots(9)).toHaveLength(6);
    expect(mealSlots(NaN)).toHaveLength(3);
  });
  it('the plan has that many meals a day, each from a recipe tagged for its slot', () => {
    const library = lib();
    for (const n of [3, 4, 5, 6]) {
      const { plan } = buildNutritionTemplate(inputs({ mealsPerDay: n }), library, { seed: 'a' });
      const slots = mealSlots(n);
      for (const day of plan.days) {
        expect(day.meals).toHaveLength(n);
        day.meals.forEach((m, i) => {
          expect(m.name).toBe(slots[i].name);
          expect(library.find((r) => r.slug === m.recipeSlug)!.meal_types).toContain(slots[i].type);
        });
      }
    }
  });
});

describe('hard filters are never relaxed', () => {
  it('never picks an allergen or the wrong diet, even when that leaves too few recipes', () => {
    const inp = inputs({ allergens: ['nuts'], diet: 'vegetarian', mealsPerDay: 3 });
    const veg = lib().map((r) => ({ ...r, diet: 'vegetarian' }));
    const nutty = [...veg.map((r, i) => (i % 2 === 0 ? { ...r, allergens: ['nuts'] } : r)), mk('meaty', ['dinner'], { diet: 'omnivore' })];
    const { plan } = buildNutritionTemplate(inp, nutty, { seed: 'x' });
    for (const day of plan.days) for (const m of day.meals) expect(recipeProblems(nutty.find((r) => r.slug === m.recipeSlug)!, inp)).toEqual([]);
    // Everything for dinner is unsafe: a clear error, not an allergen.
    const onlyUnsafe = veg.map((r) => (r.meal_types!.includes('dinner') ? { ...r, allergens: ['nuts'] } : r));
    expect(() => buildNutritionTemplate(inp, onlyUnsafe)).toThrow(TemplateError);
  });
  it('the impossible case is a clear error', () => {
    expect(() => buildNutritionTemplate(inputs({ mealsPerDay: 3 }), [])).toThrow(/Not enough recipes/);
    expect(() => buildNutritionTemplate(inputs({ mealsPerDay: 3 }), [mk('a', ['breakfast']), mk('b', ['lunch'])])).toThrow(TemplateError);
    // One recipe cannot fill two snack slots on the same day.
    const tiny = [mk('b', ['breakfast']), mk('l', ['lunch', 'dinner']), mk('l2', ['lunch', 'dinner']), mk('s', ['snack'])];
    expect(() => buildNutritionTemplate(inputs({ mealsPerDay: 5 }), tiny)).toThrow(TemplateError);
  });
});

describe('soft filters', () => {
  const all = (r: ReturnType<typeof buildNutritionTemplate>) => new Set(slugsOf(r).flat());
  it('cooking time: slow recipes stay out while there are enough quick ones', () => {
    const library = lib().map((r, i) => (i % 3 === 0 ? { ...r, prep_minutes: 60 } : r));
    const slow = new Set(library.filter((r) => r.prep_minutes! > 30).map((r) => r.slug));
    const r = buildNutritionTemplate(inputs({ cookingMinutes: 30 }), library, { seed: 'k' });
    expect([...all(r)].filter((s) => slow.has(s))).toEqual([]);
    expect(r.relaxed).toEqual([]);
  });
  it('budget: high-cost recipes stay out for a tight budget', () => {
    const library = lib().map((r, i) => (i % 4 === 0 ? { ...r, cost_tier: 'high' } : i % 4 === 1 ? { ...r, cost_tier: 'medium' } : { ...r, cost_tier: 'low' }));
    const high = new Set(library.filter((r) => r.cost_tier === 'high').map((r) => r.slug));
    const r = buildNutritionTemplate(inputs({ budget: 'low' }), library, { seed: 'k' });
    expect([...all(r)].filter((s) => high.has(s) || library.find((x) => x.slug === s)!.cost_tier === 'medium')).toEqual([]);
    expect(r.relaxed).not.toContain('budget');
  });
  it('dislikes: recipes with a disliked ingredient stay out', () => {
    const library = lib().map((r, i) => (i % 3 === 0 ? { ...r, ingredients: ['White mushroom', 'Rice'] } : r));
    const bad = new Set(library.filter((r) => r.ingredients!.includes('White mushroom')).map((r) => r.slug));
    const r = buildNutritionTemplate(inputs({ dislikes: ['mushrooms'] }), library, { seed: 'k' });
    expect([...all(r)].filter((s) => bad.has(s))).toEqual([]);
  });
  it('earlier swaps and "does not like" facts: the recipes swapped away from and the ones named stay out', () => {
    const library = lib().map((r, i) => (i === 4 ? { ...r, ingredients: ['Atlantic salmon, raw'] } : r));
    const base = buildNutritionTemplate(inputs(), library, { seed: 'k' });
    const swapped = slugsOf(base).flat().slice(0, 3);
    const r = buildNutritionTemplate(inputs(), library, { seed: 'k', avoidSlugs: swapped, facts: ['Does not like salmon'] });
    expect([...all(r)].filter((s) => swapped.includes(s) || s === library[4].slug)).toEqual([]);
  });
});

describe('relaxing, in order: cooking time, budget, swaps and memory, dislikes', () => {
  // Every breakfast is slow, expensive, swapped and disliked: all four filters hit the same slot.
  const library = () => lib().map((r) => (r.meal_types!.includes('breakfast') ? { ...r, prep_minutes: 90, cost_tier: 'high', ingredients: ['White mushroom'] } : r));
  const base = { mealsPerDay: 3, cookingMinutes: 30, budget: 'low', dislikes: ['mushrooms'] };
  const swaps = () => library().filter((r) => r.meal_types!.includes('breakfast')).map((r) => r.slug);

  it('relaxes cooking time first, and only as far as needed', () => {
    const lb = lib().map((r) => (r.meal_types!.includes('breakfast') ? { ...r, prep_minutes: 90 } : r));
    expect(buildNutritionTemplate(inputs({ mealsPerDay: 3, cookingMinutes: 30 }), lb, { seed: 'r' }).relaxed).toEqual(['cooking_time']);
  });
  it('then budget', () => {
    const lb = lib().map((r) => (r.meal_types!.includes('breakfast') ? { ...r, prep_minutes: 90, cost_tier: 'high' } : r));
    expect(buildNutritionTemplate(inputs({ mealsPerDay: 3, cookingMinutes: 30, budget: 'low' }), lb, { seed: 'r' }).relaxed).toEqual(['cooking_time', 'budget']);
  });
  it('then swaps and memory', () => {
    const lb = lib().map((r) => (r.meal_types!.includes('breakfast') ? { ...r, prep_minutes: 90, cost_tier: 'high' } : r));
    const avoid = lb.filter((r) => r.meal_types!.includes('breakfast')).map((r) => r.slug);
    expect(buildNutritionTemplate(inputs({ mealsPerDay: 3, cookingMinutes: 30, budget: 'low' }), lb, { seed: 'r', avoidSlugs: avoid }).relaxed).toEqual(['cooking_time', 'budget', 'swaps_memory']);
  });
  it('then dislikes, last; and the plan says which were relaxed', () => {
    const r = buildNutritionTemplate(inputs(base), library(), { seed: 'r', avoidSlugs: swaps() });
    expect(r.relaxed).toEqual(['cooking_time', 'budget', 'swaps_memory', 'dislikes']);
    expect(r.plan.rationale).toContain('could not fit every preference');
    // Allergens and diet were never part of it.
    for (const day of r.plan.days) for (const m of day.meals) expect(recipeProblems(library().find((x) => x.slug === m.recipeSlug)!, inputs(base))).toEqual([]);
  });
  it('relaxes nothing when everything fits', () => {
    expect(buildNutritionTemplate(inputs({ ...base, budget: 'high', cookingMinutes: 60 }), lib(), { seed: 'r' }).relaxed).toEqual([]);
  });
});

describe('targets', () => {
  it.each(['cut', 'bulk', 'recomp'])('%s: calories inside the validator band, protein at least the target minus the tolerance, carbs and fat close', (goal) => {
    const inp = inputs({ mealsPerDay: 4 }, goal);
    const library = lib();
    const { plan } = buildNutritionTemplate(inp, library, { seed: 'u1' });
    // (The full validator pass on the real recipe library is in db/meal_template.test.ts.)
    expect(validateNutrition(plan, inp, library).filter((e) => !/ is \d+, target is \d+/.test(e))).toEqual([]);
    const by = new Map(library.map((r) => [r.slug, r]));
    for (const day of plan.days) {
      const t = nutritionDayTotals(day, by);
      const w = inp.targets[day.dayType];
      expect(Math.abs(t.kcal - w.kcal)).toBeLessThanOrEqual(w.kcal * MACRO_TOLERANCE);
      expect(t.proteinG).toBeGreaterThanOrEqual(w.proteinG * (1 - MACRO_TOLERANCE));
      expect(Math.abs(t.carbsG - w.carbsG)).toBeLessThanOrEqual(w.carbsG * 0.15);
      expect(Math.abs(t.fatG - w.fatG)).toBeLessThanOrEqual(w.fatG * 0.15);
      for (const m of day.meals) {
        expect(m.portions).toBeGreaterThanOrEqual(0.5);
        expect(m.portions).toBeLessThanOrEqual(4);
        expect((m.portions * 4) % 1).toBe(0); // quarter steps at most
      }
    }
  });
  it('reports its own totals', () => {
    const inp = inputs();
    const library = lib();
    const { plan } = buildNutritionTemplate(inp, library, { seed: 'u1' });
    const by = new Map(library.map((r) => [r.slug, r]));
    for (const day of plan.days) expect(day.kcal).toBe(Math.max(800, Math.round(nutritionDayTotals(day, by).kcal)));
  });
});

describe('variety and seeds', () => {
  it('no recipe twice in a day; training and rest days share at most one recipe', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const [training, rest] = slugsOf(buildNutritionTemplate(inputs({ mealsPerDay: 5 }), lib(), { seed }));
      expect(new Set(training).size).toBe(training.length);
      expect(new Set(rest).size).toBe(rest.length);
      expect(training.filter((s) => rest.includes(s)).length).toBeLessThanOrEqual(1);
    }
  });
  it('the same seed gives the same plan, other seeds give other plans', () => {
    const a1 = buildNutritionTemplate(inputs(), lib(), { seed: 'user-1' });
    const a2 = buildNutritionTemplate(inputs(), lib(), { seed: 'user-1' });
    expect(a2).toEqual(a1);
    const others = ['user-2', 'user-3', 'user-4', 'user-5'].map((seed) => JSON.stringify(slugsOf(buildNutritionTemplate(inputs(), lib(), { seed }))));
    expect(new Set([JSON.stringify(slugsOf(a1)), ...others]).size).toBeGreaterThan(1);
  });
  it('is fast', () => {
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) buildNutritionTemplate(inputs({ mealsPerDay: 6 }), lib(), { seed: `s${i}` });
    expect((performance.now() - t0) / 5).toBeLessThan(50);
  });
});

describe('rationale', () => {
  it('is written from the inputs', () => {
    const inp = inputs({ diet: 'vegetarian', allergens: ['nuts'], cookingMinutes: 30, mealsPerDay: 4 });
    const text = templateRationale(inp, [], 4);
    expect(text).toMatch(/^Four meals a day around [\d,]+ kcal and \d+ g protein on training days, vegetarian, no nuts, 30 minutes or less to cook\./);
    expect(text).toContain('Swap any meal you like less.');
  });
  it('leaves out what does not apply and what was relaxed, and stays short', () => {
    const text = templateRationale(inputs({ mealsPerDay: 6, dislikes: ['fish'], cookingMinutes: 15 }), ['dislikes', 'cooking_time'], 6);
    expect(text.startsWith('Six meals a day')).toBe(true);
    expect(text).not.toContain('skipping');
    expect(text).not.toContain('15 minutes');
    expect(text.length).toBeLessThan(600);
  });
});
