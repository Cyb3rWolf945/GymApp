import { describe, expect, it } from 'vitest';
import * as shared from '../../../../packages/shared/src/catalog/catalog';
import * as c from './content';
import { diffLines, diffStats } from './promptdiff';
import { adherenceLabel, overallRetention, retentionRate, summarizeEngagement } from './engagement';

const form = (entries: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

describe('vocabularies', () => {
  it('match the shared catalog (they must not drift)', () => {
    expect([...c.EQUIPMENT]).toEqual([...shared.EQUIPMENT]);
    expect([...c.EXERCISE_LEVELS]).toEqual([...shared.EXERCISE_LEVELS]);
    expect([...c.CONTRAINDICATIONS]).toEqual([...shared.CONTRAINDICATIONS]);
    expect([...c.ALLERGENS]).toEqual([...shared.ALLERGENS]);
    expect([...c.DIETS]).toEqual([...shared.DIETS]);
    expect([...c.INGREDIENT_CATEGORIES]).toEqual([...shared.INGREDIENT_CATEGORIES]);
    expect([...c.MUSCLE_IDS]).toEqual([...shared.MUSCLE_IDS]);
  });
});

describe('slugify', () => {
  it('makes catalog-safe slugs', () => {
    expect(c.slugify('Barbell Back Squat')).toBe('barbell-back-squat');
    expect(c.slugify('  Crème brûlée!! ')).toBe('creme-brulee');
    expect(c.slugify('x'.repeat(100))).toHaveLength(64);
    for (const s of ['a b', 'Ünï', '---x---']) expect(c.SLUG.test(c.slugify(s))).toBe(true);
  });
});

const exercise = { name: 'Goblet squat', equipment: 'dumbbells', level: 'beginner', primary: ['quadriceps'] };
describe('validateExercise', () => {
  it('accepts a good exercise and derives the slug', () => {
    const r = c.validateExercise(form({ ...exercise, secondary: ['gluteus_maximus', 'quadriceps'], contraindications: ['knee'], mechanic: 'compound' }));
    expect(r).toMatchObject({ ok: true, value: { slug: 'goblet-squat', primary: ['quadriceps'], secondary: ['gluteus_maximus'], contraindications: ['knee'], mechanic: 'compound', instructions: null } });
  });
  it('rejects unknown vocabulary, a missing muscle, a bad slug and long text', () => {
    const bad = c.validateExercise(form({ ...exercise, equipment: 'jetpack', level: 'god', primary: [], contraindications: ['soul'], slug: 'Bad Slug', instructions: 'x'.repeat(2001) }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['contraindications', 'equipment', 'instructions', 'level', 'primary', 'slug']);
    expect(c.validateExercise(form({ ...exercise, primary: ['elbow'] })).ok).toBe(false);
  });
});

const ingredient = { name: 'Oats', category: 'grains', kcal_per_100g: '380', protein_per_100g: '13', carbs_per_100g: '60', fat_per_100g: '7' };
describe('validateIngredient', () => {
  it('accepts and rounds numbers', () => {
    expect(c.validateIngredient(form({ ...ingredient, allergens: ['gluten'] }))).toMatchObject({ ok: true, value: { name: 'Oats', kcal_per_100g: 380, allergens: ['gluten'] } });
  });
  it('rejects bad numbers, macros over 100 g, bad names and unknown allergens', () => {
    expect(c.validateIngredient(form({ ...ingredient, kcal_per_100g: '-1' })).ok).toBe(false);
    expect(c.validateIngredient(form({ ...ingredient, kcal_per_100g: '' })).ok).toBe(false);
    const over = c.validateIngredient(form({ ...ingredient, protein_per_100g: '50', carbs_per_100g: '50', fat_per_100g: '20' }));
    expect(over.ok).toBe(false);
    expect(c.validateIngredient(form({ ...ingredient, name: 'Salt, fine' })).ok).toBe(false);
    expect(c.validateIngredient(form({ ...ingredient, allergens: ['pollen'] })).ok).toBe(false);
  });
});

const ings: c.IngredientMacros[] = [
  { id: 'i1', name: 'Oats', kcal_per_100g: 380, protein_per_100g: 13, carbs_per_100g: 60, fat_per_100g: 7 },
  { id: 'i2', name: 'Whole milk', kcal_per_100g: 60, protein_per_100g: 3, carbs_per_100g: 5, fat_per_100g: 3 },
];
describe('recipes', () => {
  it('parses "name, grams" lines and reports bad ones', () => {
    expect(c.parseRecipeLines('Oats, 80\n\nWhole milk, 200')).toEqual({ lines: [{ name: 'Oats', grams: 80 }, { name: 'Whole milk', grams: 200 }], errors: [] });
    const r = c.parseRecipeLines('Oats 80\nMilk, abc\nBread, 0\nRice, 100');
    expect(r.lines).toEqual([{ name: 'Rice', grams: 100 }]);
    expect(r.errors).toHaveLength(3);
    expect(r.errors[0]).toMatch(/^Line 1/);
  });
  it('computes per-serving macros from the ingredients', () => {
    const m = c.recipeMacros([{ ingredient: ings[0], grams: 80 }, { ingredient: ings[1], grams: 200 }], 2);
    expect(m).toEqual({ kcal: 212, protein_g: 8.2, carbs_g: 29, fat_g: 5.8 });
  });
  const recipe = { name: 'Protein oats', diet: 'vegetarian', servings: '2', ingredients: 'Oats, 80\nwhole milk, 200' };
  it('accepts a recipe, matching ingredients by name without case, and computes the macros', () => {
    const r = c.validateRecipe(form(recipe), ings);
    expect(r).toMatchObject({ ok: true, value: { slug: 'protein-oats', servings: 2, kcal: 212, items: [{ ingredient_id: 'i1', grams: 80 }, { ingredient_id: 'i2', grams: 200 }] } });
  });
  it('rejects unknown or repeated ingredients, an empty list, bad servings and diets', () => {
    const msg = (f: FormData) => { const r = c.validateRecipe(f, ings); return r.ok ? '' : r.errors.ingredients ?? Object.values(r.errors).join(' '); };
    expect(msg(form({ ...recipe, ingredients: 'Oats, 80\nUnicorn, 10' }))).toMatch(/Unknown ingredient "Unicorn"/);
    expect(msg(form({ ...recipe, ingredients: 'Oats, 80\noats, 10' }))).toMatch(/listed twice/);
    expect(msg(form({ ...recipe, ingredients: '' }))).toMatch(/at least one/);
    expect(c.validateRecipe(form({ ...recipe, servings: '0' }), ings).ok).toBe(false);
    expect(c.validateRecipe(form({ ...recipe, servings: '1.5' }), ings).ok).toBe(false);
    expect(c.validateRecipe(form({ ...recipe, diet: 'carnivore' }), ings).ok).toBe(false);
  });
});

describe('validatePromptVersion', () => {
  it('accepts a name and a body, trimming and normalising line breaks', () => {
    expect(c.validatePromptVersion(form({ name: 'planner_workout', body: 'You design plans.\r\nRule one.  ', model: ' ' }))).toEqual({ ok: true, value: { name: 'planner_workout', model: null, body: 'You design plans.\nRule one.' } });
  });
  it('rejects bad names and too short or too long bodies', () => {
    expect(c.validatePromptVersion(form({ name: 'Bad Name', body: 'long enough body' })).ok).toBe(false);
    expect(c.validatePromptVersion(form({ name: 'ok_name', body: 'short' })).ok).toBe(false);
    expect(c.validatePromptVersion(form({ name: 'ok_name', body: 'x'.repeat(c.MAX_PROMPT_LENGTH + 1) })).ok).toBe(false);
  });
});

describe('diffLines', () => {
  it('shows what was added and removed, line by line', () => {
    const d = diffLines('a\nb\nc', 'a\nB\nc\nd');
    expect(d).toEqual([
      { kind: 'same', text: 'a' }, { kind: 'removed', text: 'b' }, { kind: 'added', text: 'B' }, { kind: 'same', text: 'c' }, { kind: 'added', text: 'd' },
    ]);
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 });
  });
  it('handles identical and empty texts', () => {
    expect(diffLines('x\ny', 'x\ny').every((l) => l.kind === 'same')).toBe(true);
    expect(diffLines('', 'a')).toEqual([{ kind: 'added', text: 'a' }]);
    expect(diffLines('a', '')).toEqual([{ kind: 'removed', text: 'a' }]);
    expect(diffLines('', '')).toEqual([]);
  });
});

describe('engagement helpers', () => {
  it('retention rate: null until reached, 0 for empty cohorts', () => {
    expect(retentionRate(3, 10)).toBe(0.3);
    expect(retentionRate(null, 10)).toBeNull();
    expect(retentionRate(0, 0)).toBe(0);
  });
  it('summarizes the last day and the average workouts per day', () => {
    const s = summarizeEngagement([{ day: 'a', dau: 2, wau: 10, workouts: 1 }, { day: 'b', dau: 5, wau: 20, workouts: 4 }]);
    expect(s).toEqual({ dau: 5, wau: 20, stickiness: 0.25, workoutsPerDay: 2.5 });
    expect(summarizeEngagement([])).toEqual({ dau: 0, wau: 0, stickiness: null, workoutsPerDay: 0 });
  });
  it('weights retention by cohort size and skips cohorts that are too young', () => {
    const r = overallRetention([
      { cohort: 'old', size: 90, d1: 45, d7: 18, d30: 9 },
      { cohort: 'mid', size: 10, d1: 1, d7: 0, d30: null },
      { cohort: 'new', size: 5, d1: null, d7: null, d30: null },
    ]);
    expect(r.d1).toBeCloseTo(0.46, 2);
    expect(r.d7).toBeCloseTo(0.18, 2);
    expect(r.d30).toBeCloseTo(0.1, 2);
    expect(overallRetention([])).toEqual({ d1: null, d7: null, d30: null });
  });
  it('labels adherence', () => {
    expect(adherenceLabel(62.5, 40)).toBe('63% (40 users)');
    expect(adherenceLabel(null, 0)).toBe('–');
  });
});

import { SUITE_LABELS, evalPassRate } from './evals';
import { AUDIT_ACTIONS } from './audit';
import { NAV } from './nav';

describe('evals and navigation', () => {
  it('computes the pass rate', () => {
    expect(evalPassRate(24, 24)).toBe(1);
    expect(evalPassRate(18, 24)).toBe(0.75);
    expect(evalPassRate(0, 0)).toBeNull();
    expect(Object.keys(SUITE_LABELS)).toEqual(['red_team', 'plan_quality']);
  });
  it('audits content edits and prompt changes', () => {
    for (const a of ['edit_content', 'create_prompt_version', 'activate_prompt_version']) expect(AUDIT_ACTIONS).toContain(a);
  });
  it('Engagement and Content are real pages now, not placeholders', () => {
    for (const href of ['/engagement', '/content']) expect(NAV.find((n) => n.href === href)?.comingIn).toBeUndefined();
  });
});
