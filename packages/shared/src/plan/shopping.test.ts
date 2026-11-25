import { describe, expect, it } from 'vitest';
import type { NutritionPlan } from '../ai/schemas.ts';
import { activeChecked, buildShoppingList, formatQuantity, type ShoppingRecipe } from './shopping.ts';

const day = (dayType: 'training' | 'rest', meals: [string, number][]) => ({
  dayType, kcal: 2000, proteinG: 1, carbsG: 1, fatG: 1,
  meals: meals.map(([recipeSlug, portions], i) => ({ name: `M${i}`, recipeSlug, portions })),
});
const plan = (days: ReturnType<typeof day>[]) => ({ rationale: 'x', days }) as NutritionPlan;
const recipes = new Map<string, ShoppingRecipe>([
  ['oats', { servings: 2, ingredients: [{ name: 'Oats', category: 'grains', grams: 100 }, { name: 'Milk', category: 'dairy', grams: 400 }] }],
  ['rice', { servings: 1, ingredients: [{ name: 'Rice', category: 'grains', grams: 150 }, { name: 'Salt', category: null, grams: 3 }] }],
  ['bowl', { servings: 1, ingredients: [{ name: 'Rice', category: 'grains', grams: 50 }] }],
]);

describe('formatQuantity', () => {
  it('normalises grams and kilograms', () => {
    expect(formatQuantity(12)).toBe('10 g');
    expect(formatQuantity(1)).toBe('5 g');
    expect(formatQuantity(1000)).toBe('1 kg');
    expect(formatQuantity(1240)).toBe('1.24 kg');
    expect(formatQuantity(2500)).toBe('2.5 kg');
  });
});

describe('buildShoppingList', () => {
  const p = plan([day('training', [['oats', 1], ['rice', 2]]), day('rest', [['bowl', 1]])]);

  it('sums per week, scales by portions and servings, and merges the same ingredient', () => {
    const groups = buildShoppingList(p, { training: 3, rest: 4 }, recipes);
    const flat = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.label, i.grams])));
    // Oats: 100/2 × 1 × 3 = 150; Rice: 150×2×3 + 50×1×4 = 1100
    expect(flat).toMatchObject({ Oats: 150, Milk: 600, Rice: 1100 });
    expect(flat.Salt).toBeCloseTo(18);
  });

  it('groups by category in catalog order, unknown categories last, items sorted', () => {
    const groups = buildShoppingList(p, { training: 3, rest: 4 }, recipes);
    expect(groups.map((g) => g.category)).toEqual(['dairy', 'grains', 'other']);
    expect(groups[1].items.map((i) => i.label)).toEqual(['Oats', 'Rice']);
    expect(groups[1].items[1].quantity).toBe('1.1 kg');
  });

  it('follows the plan: a swapped meal changes the list; unknown recipes and unused day types are skipped', () => {
    const swapped = plan([day('training', [['bowl', 1]]), day('rest', [['ghost', 1]])]);
    const groups = buildShoppingList(swapped, { training: 7, rest: 0 }, recipes);
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual(['Rice']);
    expect(groups[0].items[0].grams).toBe(350);
  });
});

describe('activeChecked', () => {
  it('drops checked labels that are no longer on the list', () => {
    const groups = buildShoppingList(plan([day('training', [['bowl', 1]])]), { training: 1, rest: 0 }, recipes);
    expect([...activeChecked(groups, ['Rice', 'Gone'])]).toEqual(['Rice']);
  });
});
