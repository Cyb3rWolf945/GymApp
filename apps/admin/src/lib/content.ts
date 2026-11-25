// Content editing: validation for the exercise, ingredient and recipe forms. Pure, so the rules are unit-tested.
// The vocabularies are copies of packages/shared/src/catalog (the admin app does not import the shared package);
// a test fails if they drift.

export const EQUIPMENT = ['full_gym', 'basic_gym', 'dumbbells', 'barbell', 'kettlebell', 'bands', 'bodyweight'] as const;
export const EXERCISE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const CONTRAINDICATIONS = ['knee', 'shoulder', 'lower_back', 'elbow', 'wrist', 'hip', 'neck'] as const;
export const ALLERGENS = ['gluten', 'lactose', 'nuts', 'shellfish', 'egg', 'soy', 'fish'] as const;
export const DIETS = ['omnivore', 'vegetarian', 'vegan'] as const;
export const INGREDIENT_CATEGORIES = [
  'produce', 'meat', 'fish_seafood', 'dairy', 'eggs', 'grains', 'legumes', 'plant_protein', 'nuts_seeds', 'fats_oils', 'condiments', 'spices',
] as const;
export const MUSCLE_IDS = [
  'pectoralis_major', 'pectoralis_minor', 'serratus_anterior', 'deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'trapezius', 'rhomboids',
  'latissimus_dorsi', 'erector_spinae', 'rectus_abdominis', 'obliques', 'transversus_abdominis', 'biceps_brachii', 'brachialis', 'triceps_brachii',
  'forearm_flexors', 'forearm_extensors', 'quadriceps', 'hamstrings', 'gluteus_maximus', 'gluteus_medius', 'hip_adductors', 'hip_flexors',
  'gastrocnemius', 'soleus', 'tibialis_anterior', 'neck_flexors',
] as const;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/** Slugs are lowercase letters, digits and dashes: they are also what the planner and the apps reference. */
export const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

const str = (f: FormData, k: string): string => String(f.get(k) ?? '').trim();
const many = (f: FormData, k: string): string[] => f.getAll(k).map((v) => String(v)).filter(Boolean);
const oneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);
const allIn = <T extends string>(list: readonly T[], vs: string[]): vs is T[] => vs.every((v) => oneOf(list, v));

function num(f: FormData, k: string, min: number, max: number, errors: Record<string, string>, label: string): number {
  const raw = str(f, k);
  const n = Number(raw);
  if (raw === '' || !Number.isFinite(n) || n < min || n > max) {
    errors[k] = `${label} must be a number from ${min} to ${max}.`;
    return 0;
  }
  return Math.round(n * 10) / 10;
}

export interface ExerciseInput {
  slug: string;
  name: string;
  equipment: (typeof EQUIPMENT)[number];
  level: (typeof EXERCISE_LEVELS)[number];
  contraindications: (typeof CONTRAINDICATIONS)[number][];
  mechanic: string | null;
  instructions: string | null;
  primary: (typeof MUSCLE_IDS)[number][];
  secondary: (typeof MUSCLE_IDS)[number][];
}

export function validateExercise(f: FormData): Result<ExerciseInput> {
  const errors: Record<string, string> = {};
  const name = str(f, 'name');
  if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2 to 80 characters.';
  const slug = str(f, 'slug') || slugify(name);
  if (!SLUG.test(slug)) errors.slug = 'Slug: lowercase letters, digits and dashes.';
  const equipment = str(f, 'equipment');
  if (!oneOf(EQUIPMENT, equipment)) errors.equipment = 'Pick the equipment.';
  const level = str(f, 'level');
  if (!oneOf(EXERCISE_LEVELS, level)) errors.level = 'Pick a level.';
  const contraindications = many(f, 'contraindications');
  if (!allIn(CONTRAINDICATIONS, contraindications)) errors.contraindications = 'Unknown body zone.';
  const primary = many(f, 'primary');
  const secondary = many(f, 'secondary').filter((m) => !primary.includes(m));
  if (primary.length === 0) errors.primary = 'Pick at least one primary muscle.';
  if (!allIn(MUSCLE_IDS, primary) || !allIn(MUSCLE_IDS, secondary)) errors.primary = 'Unknown muscle.';
  const mechanic = str(f, 'mechanic');
  if (mechanic.length > 40) errors.mechanic = 'Mechanic is at most 40 characters.';
  const instructions = str(f, 'instructions');
  if (instructions.length > 2000) errors.instructions = 'Instructions are at most 2000 characters.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug, name, equipment: equipment as ExerciseInput['equipment'], level: level as ExerciseInput['level'],
      contraindications: contraindications as ExerciseInput['contraindications'], mechanic: mechanic || null, instructions: instructions || null,
      primary: primary as ExerciseInput['primary'], secondary: secondary as ExerciseInput['secondary'],
    },
  };
}

export interface IngredientInput {
  name: string;
  category: (typeof INGREDIENT_CATEGORIES)[number];
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  allergens: (typeof ALLERGENS)[number][];
}

export function validateIngredient(f: FormData): Result<IngredientInput> {
  const errors: Record<string, string> = {};
  const name = str(f, 'name');
  if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2 to 80 characters.';
  // Recipe lines refer to ingredients by name, so a comma or a line break would break them.
  if (/[,\n\r]/.test(name)) errors.name = 'Name cannot contain commas or line breaks.';
  const category = str(f, 'category');
  if (!oneOf(INGREDIENT_CATEGORIES, category)) errors.category = 'Pick a category.';
  const kcal = num(f, 'kcal_per_100g', 0, 900, errors, 'Calories');
  const protein = num(f, 'protein_per_100g', 0, 100, errors, 'Protein');
  const carbs = num(f, 'carbs_per_100g', 0, 100, errors, 'Carbs');
  const fat = num(f, 'fat_per_100g', 0, 100, errors, 'Fat');
  if (!errors.protein_per_100g && !errors.carbs_per_100g && !errors.fat_per_100g && protein + carbs + fat > 100.5) {
    errors.fat_per_100g = 'Protein, carbs and fat cannot add up to more than 100 g per 100 g.';
  }
  const allergens = many(f, 'allergens');
  if (!allIn(ALLERGENS, allergens)) errors.allergens = 'Unknown allergen.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, category: category as IngredientInput['category'], kcal_per_100g: kcal, protein_per_100g: protein, carbs_per_100g: carbs, fat_per_100g: fat, allergens: allergens as IngredientInput['allergens'] },
  };
}

export interface RecipeLine {
  name: string;
  grams: number;
}

/** "Chicken breast, 200" per line. Returns the lines and a message per bad line (by line number). */
export function parseRecipeLines(text: string): { lines: RecipeLine[]; errors: string[] } {
  const lines: RecipeLine[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const at = line.lastIndexOf(',');
    const name = at > 0 ? line.slice(0, at).trim() : '';
    const grams = at > 0 ? Number(line.slice(at + 1).trim()) : NaN;
    if (!name || !Number.isFinite(grams) || grams < 1 || grams > 3000) errors.push(`Line ${i + 1}: use "ingredient name, grams" (1 to 3000 g).`);
    else lines.push({ name, grams });
  });
  return { lines, errors };
}

export interface IngredientMacros {
  id: string;
  name: string;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
}

export interface RecipeInput {
  slug: string;
  name: string;
  diet: (typeof DIETS)[number];
  servings: number;
  instructions: string | null;
  items: { ingredient_id: string; grams: number }[];
  /** Per serving, computed from the ingredients (never typed in by hand). */
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Macros per serving from the ingredient lines. */
export function recipeMacros(items: readonly { ingredient: IngredientMacros; grams: number }[], servings: number) {
  const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const { ingredient: i, grams } of items) {
    const k = grams / 100;
    t.kcal += (i.kcal_per_100g ?? 0) * k;
    t.protein_g += (i.protein_per_100g ?? 0) * k;
    t.carbs_g += (i.carbs_per_100g ?? 0) * k;
    t.fat_g += (i.fat_per_100g ?? 0) * k;
  }
  const s = Math.max(1, servings);
  const r = (n: number) => Math.round((n / s) * 10) / 10;
  return { kcal: r(t.kcal), protein_g: r(t.protein_g), carbs_g: r(t.carbs_g), fat_g: r(t.fat_g) };
}

export function validateRecipe(f: FormData, ingredients: readonly IngredientMacros[]): Result<RecipeInput> {
  const errors: Record<string, string> = {};
  const name = str(f, 'name');
  if (name.length < 2 || name.length > 100) errors.name = 'Name must be 2 to 100 characters.';
  const slug = str(f, 'slug') || slugify(name);
  if (!SLUG.test(slug)) errors.slug = 'Slug: lowercase letters, digits and dashes.';
  const diet = str(f, 'diet');
  if (!oneOf(DIETS, diet)) errors.diet = 'Pick a diet.';
  const servings = Number(str(f, 'servings'));
  if (!Number.isInteger(servings) || servings < 1 || servings > 12) errors.servings = 'Servings: a whole number from 1 to 12.';
  const instructions = str(f, 'instructions');
  if (instructions.length > 4000) errors.instructions = 'Instructions are at most 4000 characters.';

  const parsed = parseRecipeLines(str(f, 'ingredients'));
  const byName = new Map(ingredients.map((i) => [i.name.toLowerCase(), i]));
  const problems = [...parsed.errors];
  const resolved: { ingredient: IngredientMacros; grams: number }[] = [];
  const seen = new Set<string>();
  for (const l of parsed.lines) {
    const ing = byName.get(l.name.toLowerCase());
    if (!ing) problems.push(`Unknown ingredient "${l.name}". Add it under Ingredients first.`);
    else if (seen.has(ing.id)) problems.push(`"${l.name}" is listed twice.`);
    else {
      seen.add(ing.id);
      resolved.push({ ingredient: ing, grams: l.grams });
    }
  }
  if (parsed.lines.length === 0 && parsed.errors.length === 0) problems.push('Add at least one ingredient.');
  if (problems.length > 0) errors.ingredients = problems.slice(0, 3).join(' ');
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug, name, diet: diet as RecipeInput['diet'], servings, instructions: instructions || null,
      items: resolved.map((r) => ({ ingredient_id: r.ingredient.id, grams: r.grams })),
      ...recipeMacros(resolved, servings),
    },
  };
}

// ---- prompt versions ----

export const PROMPT_NAME = /^[a-z][a-z0-9_]{1,39}$/;
export const MAX_PROMPT_LENGTH = 20_000;

export function validatePromptVersion(f: FormData): Result<{ name: string; model: string | null; body: string }> {
  const errors: Record<string, string> = {};
  const name = str(f, 'name');
  if (!PROMPT_NAME.test(name)) errors.name = 'Name: lowercase letters, digits and underscores (2 to 40).';
  const body = String(f.get('body') ?? '').replace(/\r\n/g, '\n').trim();
  if (body.length < 10 || body.length > MAX_PROMPT_LENGTH) errors.body = `The prompt must be 10 to ${MAX_PROMPT_LENGTH} characters.`;
  const model = str(f, 'model');
  if (model.length > 80) errors.model = 'Model is at most 80 characters.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, model: model || null, body } };
}
