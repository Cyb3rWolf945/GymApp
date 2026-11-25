import { describe, expect, it } from 'vitest';
import { ALLERGENS, deriveAllergens, MUSCLE_IDS } from './catalog';

describe('muscle IDs', () => {
  it('are unique snake_case identifiers', () => {
    expect(new Set(MUSCLE_IDS).size).toBe(MUSCLE_IDS.length);
    for (const id of MUSCLE_IDS) expect(id).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });
});

describe('deriveAllergens', () => {
  it('is empty for no ingredients or ingredients without flags', () => {
    expect(deriveAllergens([])).toEqual([]);
    expect(deriveAllergens([{ allergens: [] }, { allergens: [] }])).toEqual([]);
  });

  it('is the union of ingredient flags, deduplicated, in ALLERGENS order', () => {
    const out = deriveAllergens([
      { allergens: ['egg', 'lactose'] },
      { allergens: ['gluten'] },
      { allergens: ['lactose', 'gluten'] },
    ]);
    expect(out).toEqual(['gluten', 'lactose', 'egg']);
    expect(out.every((a) => (ALLERGENS as readonly string[]).includes(a))).toBe(true);
  });
});
