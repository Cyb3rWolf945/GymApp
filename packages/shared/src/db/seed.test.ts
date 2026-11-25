import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLERGENS, deriveAllergens, MUSCLE_IDS } from '../catalog';
import { applySeed, createDb } from './harness';

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
}, 120_000);
afterAll(() => db.close());

const count = async (table: string) =>
  Number((await db.query<{ n: string }>(`select count(*)::text as n from public.${table}`)).rows[0].n);

describe('catalog seed', () => {
  it('applies cleanly on top of the migrations and fills the catalog', async () => {
    expect(await count('exercises')).toBeGreaterThanOrEqual(140);
    expect(await count('ingredients')).toBeGreaterThanOrEqual(140);
    expect(await count('recipes')).toBeGreaterThanOrEqual(55);
  });

  it('every exercise references valid muscle IDs and has a primary muscle', async () => {
    const used = await db.query<{ muscle: string }>(`select distinct muscle from public.exercise_muscles`);
    const valid = new Set<string>(MUSCLE_IDS);
    expect(used.rows.map((r) => r.muscle).filter((m) => !valid.has(m))).toEqual([]);

    const noPrimary = await db.query<{ slug: string }>(
      `select e.slug from public.exercises e
       where not exists (select 1 from public.exercise_muscles m where m.exercise_id = e.id and m.role = 'primary')`,
    );
    expect(noPrimary.rows).toEqual([]);
  });

  it("every recipe's allergen flags derive from its ingredients", async () => {
    const recipes = await db.query<{ slug: string }>(`select slug from public.recipes`);
    // Ingredient flags per recipe, read row by row.
    const perRecipe = await db.query<{ slug: string; allergens: string[] }>(
      `select r.slug, i.allergens
       from public.recipes r
       join public.recipe_ingredients ri on ri.recipe_id = r.id
       join public.ingredients i on i.id = ri.ingredient_id`,
    );
    // Independent aggregate in SQL, to cross-check the TypeScript derivation.
    const aggregated = await db.query<{ slug: string; allergens: string[] }>(
      `select r.slug, coalesce(array_agg(distinct a) filter (where a is not null), '{}') as allergens
       from public.recipes r
       left join public.recipe_ingredients ri on ri.recipe_id = r.id
       left join public.ingredients i on i.id = ri.ingredient_id
       left join lateral unnest(i.allergens) a on true
       group by r.slug`,
    );
    const sqlFlags = new Map(aggregated.rows.map((r) => [r.slug, new Set(r.allergens)]));

    for (const { slug } of recipes.rows) {
      const rows = perRecipe.rows.filter((r) => r.slug === slug);
      expect(rows.length, `${slug} has ingredients`).toBeGreaterThan(0);
      const derived = deriveAllergens(rows.map((r) => ({ allergens: r.allergens })));
      expect(derived, slug).toEqual(ALLERGENS.filter((a) => sqlFlags.get(slug)?.has(a)));
    }

    const caesar = deriveAllergens(
      perRecipe.rows.filter((r) => r.slug === 'chicken-caesar-wrap').map((r) => ({ allergens: r.allergens })),
    );
    expect(caesar).toEqual(['gluten', 'lactose', 'egg']);
  });

  it('diet tags agree with ingredient categories', async () => {
    const rows = await db.query<{ slug: string; diet: string; category: string }>(
      `select r.slug, r.diet, i.category
       from public.recipes r
       join public.recipe_ingredients ri on ri.recipe_id = r.id
       join public.ingredients i on i.id = ri.ingredient_id`,
    );
    const animalInVegan = rows.rows.filter((r) =>
      r.diet === 'vegan' && ['meat', 'fish_seafood', 'dairy', 'eggs'].includes(r.category));
    const meatInVegetarian = rows.rows.filter((r) =>
      r.diet === 'vegetarian' && ['meat', 'fish_seafood'].includes(r.category));
    expect(animalInVegan).toEqual([]);
    expect(meatInVegetarian).toEqual([]);

    const byDiet = await db.query<{ diet: string; n: string }>(
      `select diet, count(*)::text as n from public.recipes group by diet`,
    );
    const counts = Object.fromEntries(byDiet.rows.map((r) => [r.diet, Number(r.n)]));
    expect(counts.omnivore).toBeGreaterThanOrEqual(20);
    expect(counts.vegetarian).toBeGreaterThanOrEqual(15);
    expect(counts.vegan).toBeGreaterThanOrEqual(15);
  });

  it('recipe macros are filled from ingredients', async () => {
    const missing = await db.query<{ slug: string }>(
      `select slug from public.recipes where kcal is null or protein_g is null or carbs_g is null or fat_g is null`,
    );
    expect(missing.rows).toEqual([]);
  });
});
