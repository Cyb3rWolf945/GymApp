import { describe, expect, it } from 'vitest';
import type { RecipeCandidate } from '../ai/prompts.ts';
import { applyMealSwaps } from './meals.ts';
import { INLINE_OPTIONS, MAX_OPTIONS, MIN_OPTION_CARD_WIDTH, type MealOptionsInput, clearEatenSlot, mealOptions, optionRowLayout, portionsFor, seededUnit, withoutSwap } from './mealOptions.ts';

const r = (slug: string, kcal: number, extra: Partial<RecipeCandidate> = {}): RecipeCandidate => ({
  slug, name: slug, diet: 'omnivore', kcal, protein_g: 30, carbs_g: 40, fat_g: 15, allergens: [], meal_types: ['breakfast', 'lunch', 'dinner', 'snack'], ...extra,
});
const base = (library: RecipeCandidate[], extra: Partial<MealOptionsInput> = {}): MealOptionsInput => ({
  current: { slug: 'cur', kcal: 500, portions: 1, proteinG: 30 },
  slotName: 'Dinner',
  library,
  profile: { diet: 'omnivore', allergens: [] },
  ...extra,
});
const slugs = (o: ReturnType<typeof mealOptions>) => o.map((x) => x.recipe.slug);

describe('portionsFor', () => {
  it('uses 0.5 steps and only lands within 10% of the slot', () => {
    expect(portionsFor(250, 500)).toBe(2);
    expect(portionsFor(330, 500)).toBe(1.5); // 495
    expect(portionsFor(1000, 500)).toBe(0.5);
    expect(portionsFor(400, 500)).toBeNull(); // 1 portion is 400 (-20%), 1.5 is 600 (+20%)
    expect(portionsFor(0, 500)).toBeNull();
  });
});

describe('mealOptions', () => {
  it('only offers recipes that fit the slot (dinner never gets a breakfast-only recipe), unknown slot names fit anything', () => {
    const lib = [r('cur', 500), r('dinner-a', 510, { meal_types: ['dinner'] }), r('breakfast-a', 505, { meal_types: ['breakfast'] }), r('untyped', 495, { meal_types: undefined })];
    expect(slugs(mealOptions(base(lib)))).toEqual(expect.arrayContaining(['dinner-a', 'untyped']));
    expect(slugs(mealOptions(base(lib)))).not.toContain('breakfast-a');
    expect(slugs(mealOptions(base(lib, { slotName: 'Meal 2' })))).toContain('breakfast-a');
  });
  it('never offers an allergen or the wrong diet, even when that leaves nothing', () => {
    const lib = [r('cur', 500), r('nuts', 500, { allergens: ['nuts'] }), r('meat', 500, { diet: 'omnivore' }), r('veg', 500, { diet: 'vegetarian' })];
    const got = mealOptions(base(lib, { profile: { diet: 'vegetarian', allergens: ['nuts'] } }));
    expect(slugs(got)).toEqual(['veg']);
    expect(mealOptions(base([r('cur', 500), r('nuts', 500, { allergens: ['nuts'] })], { profile: { diet: 'omnivore', allergens: ['nuts'] } }))).toEqual([]);
  });
  it('excludes the current recipe and the ones already used that day', () => {
    const lib = [r('cur', 500), r('a', 500), r('b', 500)];
    expect(slugs(mealOptions(base(lib, { usedInDay: ['a'] })))).toEqual(['b']);
  });
  it('soft filters (dislikes, cooking time, budget, swapped away) push recipes down, and are given up only to avoid showing too few', () => {
    const lib = [
      r('cur', 500),
      r('slow', 500, { prep_minutes: 60 }),
      r('pricey', 500, { cost_tier: 'high' }),
      r('away', 500),
      r('mushroom', 500, { ingredients: ['mushrooms'] }),
      r('ok1', 520, { prep_minutes: 10, cost_tier: 'low' }),
      r('ok2', 480, { prep_minutes: 10, cost_tier: 'low' }),
      r('ok3', 510, { prep_minutes: 10, cost_tier: 'low' }),
    ];
    const profile = { diet: 'omnivore', allergens: [], dislikes: ['mushrooms'], cookingMinutes: 30, budget: 'low' } as const;
    const got = slugs(mealOptions(base(lib, { profile, swappedAway: ['away'] })));
    expect(got.slice(0, 3).sort()).toEqual(['ok1', 'ok2', 'ok3']); // the clean ones first
    // With only one clean option, the rest are filled from the soft-violators so there are still INLINE_OPTIONS.
    const few = slugs(mealOptions(base([r('cur', 500), r('ok1', 520, { prep_minutes: 10 }), r('slow', 500, { prep_minutes: 60 }), r('slow2', 490, { prep_minutes: 90 })], { profile })));
    expect(few[0]).toBe('ok1');
    expect(few).toHaveLength(INLINE_OPTIONS);
    // ...but a "doesn't like" memory fact counts as soft too.
    expect(slugs(mealOptions(base([r('cur', 500), r('x', 500, { ingredients: ['Tofu'] }), r('y', 500, { ingredients: ['rice'] })], { dislikeFacts: ['doesn\'t like tofu'] })))[0]).toBe('y');
  });
  it('adjusts the portions so the option keeps the slot kcal, and drops what cannot be adjusted', () => {
    const lib = [r('cur', 500), r('light', 250), r('big', 1000), r('odd', 400)];
    const got = mealOptions(base(lib));
    const by = Object.fromEntries(got.map((o) => [o.recipe.slug, o]));
    expect(by.light.portions).toBe(2);
    expect(by.light.kcal).toBe(500);
    expect(by.big.portions).toBe(0.5);
    expect(by.odd).toBeUndefined();
    for (const o of got) expect(Math.abs(o.kcal - 500)).toBeLessThanOrEqual(50);
  });
  it('ranks the closest macros first, then variety, and is the same every time for a user and seed', () => {
    const lib = [r('cur', 500, { ingredients: ['chicken'] }), r('far', 540), r('near', 505), r('same-main', 500, { ingredients: ['chicken'] }), r('diff-main', 500, { ingredients: ['beef'] })];
    const got = slugs(mealOptions(base(lib)));
    expect(got[0]).toBe('diff-main'); // exact kcal and protein, a different main ingredient
    expect(got.indexOf('near')).toBeLessThan(got.indexOf('far'));
    const tied = [r('cur', 500), r('t1', 500), r('t2', 500), r('t3', 500), r('t4', 500)];
    const a = slugs(mealOptions(base(tied, { seed: 'user-1' })));
    expect(slugs(mealOptions(base(tied, { seed: 'user-1' })))).toEqual(a);
    expect(slugs(mealOptions(base(tied, { seed: 'user-2' })))).not.toEqual(a);
    expect(seededUnit('x')).toBeGreaterThanOrEqual(0);
    expect(seededUnit('x')).toBeLessThan(1);
  });
  it('lists at most 8, or the limit asked for; shows fewer when there are fewer, and none for a slot with no kcal', () => {
    const lib = [r('cur', 500), ...Array.from({ length: 12 }, (_, i) => r(`o${i}`, 500))];
    expect(mealOptions(base(lib))).toHaveLength(MAX_OPTIONS);
    expect(mealOptions(base(lib, { limit: 3 }))).toHaveLength(3);
    expect(mealOptions(base([r('cur', 500), r('a', 500)]))).toHaveLength(1);
    expect(mealOptions(base(lib, { current: { slug: 'cur', kcal: null, portions: 1 } }))).toEqual([]);
  });
});

describe('choosing, undoing and "eaten"', () => {
  const plan = { days: [{ dayType: 'training', meals: [{ name: 'Dinner', recipeSlug: 'cur', portions: 1 }] }] } as never;
  it('a swap with portions changes the recipe and the portions; dropping the swap (undo) gives the previous meal back', () => {
    const swaps = [{ id: 's1', day_index: 0, meal_index: 0, from_slug: 'cur', to_slug: 'light', portions: 2, created_at: '2026-11-26T10:00:00Z' }];
    const swapped = applyMealSwaps(plan, swaps) as { days: { meals: { recipeSlug: string; portions: number }[] }[] };
    expect(swapped.days[0].meals[0]).toMatchObject({ recipeSlug: 'light', portions: 2 });
    const undone = applyMealSwaps(plan, withoutSwap(swaps, 's1')) as typeof swapped;
    expect(undone.days[0].meals[0]).toMatchObject({ recipeSlug: 'cur', portions: 1 });
  });
  it('a swap without portions keeps the slot portions', () => {
    const out = applyMealSwaps(plan, [{ day_index: 0, meal_index: 0, from_slug: 'cur', to_slug: 'b', created_at: '2026-11-26T10:00:00Z' }]) as { days: { meals: { portions: number }[] }[] };
    expect(out.days[0].meals[0].portions).toBe(1);
  });
  it('choosing another meal clears "eaten" for that slot only, and says whether it did', () => {
    expect(clearEatenSlot([0, 2], 2)).toEqual({ eaten: [0], cleared: true });
    expect(clearEatenSlot([0], 1)).toEqual({ eaten: [0], cleared: false });
  });
});

describe('optionRowLayout (equal columns only where each card is wide enough)', () => {
  const gap = 8;
  it('uses equal columns when every card gets at least the minimum width', () => {
    // 3 cards in 482 px: (482 - 16) / 3 = 155.3 each.
    expect(optionRowLayout(482, 3, gap)).toBe('equal');
    expect(optionRowLayout(3 * MIN_OPTION_CARD_WIDTH + 2 * gap, 3, gap)).toBe('equal'); // exactly the minimum
    expect(optionRowLayout(2 * MIN_OPTION_CARD_WIDTH + gap, 2, gap)).toBe('equal');
  });
  it('scrolls when a card would be narrower than the minimum', () => {
    expect(optionRowLayout(3 * MIN_OPTION_CARD_WIDTH + 2 * gap - 1, 3, gap)).toBe('scroll'); // one px short
    // The widths QA measured between 600 and 1024 px: cards of 39, 76 and 97 px.
    expect(optionRowLayout(39 * 3 + 16, 3, gap)).toBe('scroll');
    expect(optionRowLayout(76 * 3 + 16, 3, gap)).toBe('scroll');
    expect(optionRowLayout(97 * 3 + 16, 3, gap)).toBe('scroll');
  });
  it('keeps equal columns at the 1440 px desktop width (163 px cards)', () => {
    expect(optionRowLayout(163 * 3 + 16, 3, gap)).toBe('equal');
  });
  it('scrolls while the container is not measured yet, or when there are no cards', () => {
    expect(optionRowLayout(0, 3, gap)).toBe('scroll');
    expect(optionRowLayout(Number.NaN, 3, gap)).toBe('scroll');
    expect(optionRowLayout(600, 0, gap)).toBe('scroll');
  });
  it('a single card gets the whole width, so it only needs the minimum for itself', () => {
    expect(optionRowLayout(MIN_OPTION_CARD_WIDTH, 1, gap)).toBe('equal');
    expect(optionRowLayout(MIN_OPTION_CARD_WIDTH - 1, 1, gap)).toBe('scroll');
  });
});
