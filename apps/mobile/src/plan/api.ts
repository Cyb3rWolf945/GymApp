import { type Allergen, type JobRow, type ShoppingRecipe, type PlanKind, type RecipeCandidate, PLAN_KINDS, deriveAllergens, expandEquipment, isEntitled } from '@gymapp/shared';
import { supabase } from '../supabase';

export async function fetchJobs(userId: string): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('id,kind,status,created_at,result,error')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as JobRow[];
}

export type StartResult = 'started' | 'needs_trial' | 'error';

/** Ask the Edge Function for a plan. It returns the job already running for this kind, if any. */
export async function startGeneration(kind: PlanKind): Promise<StartResult> {
  const { error } = await supabase.functions.invoke('generate-plan', { body: { kind } });
  if (!error) return 'started';
  const status = (error as { context?: { status?: number } }).context?.status;
  return status === 403 ? 'needs_trial' : 'error';
}

export const START_KINDS = PLAN_KINDS;

export async function fetchEntitled(userId: string): Promise<boolean> {
  const { data } = await supabase.from('entitlements').select('tier,status').eq('user_id', userId).maybeSingle();
  return isEntitled(data);
}

/** Catalog names for the slugs in a plan. */
export async function fetchCatalogNames(exerciseSlugs: string[], recipeSlugs: string[]) {
  const [ex, rc] = await Promise.all([
    exerciseSlugs.length ? supabase.from('exercises').select('slug,name').in('slug', exerciseSlugs) : { data: [] },
    recipeSlugs.length ? supabase.from('recipes').select('slug,name,diet,kcal,protein_g,carbs_g,fat_g').in('slug', recipeSlugs) : { data: [] },
  ]);
  const exerciseNames = new Map(((ex.data ?? []) as { slug: string; name: string }[]).map((e) => [e.slug, e.name]));
  const recipes = ((rc.data ?? []) as Omit<RecipeCandidate, 'allergens'>[]).map((r) => ({ ...r, allergens: [] })) as RecipeCandidate[];
  return { exerciseNames, recipes };
}

export interface SwapOption {
  slug: string;
  name: string;
  equipment: string | null;
  level: string;
}

/** Deterministic alternatives from the library (same primary muscle, your equipment, no contraindications). */
export async function fetchSwapOptions(
  slug: string,
  profile: { equipment: string[]; contraindications: string[]; level: string },
  excludeSlugs: string[],
): Promise<SwapOption[]> {
  const { data, error } = await supabase.rpc('swap_candidates', {
    p_slug: slug,
    p_equipment: expandEquipment(profile.equipment),
    p_contraindications: profile.contraindications,
    p_level: profile.level,
    p_exclude: excludeSlugs,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as SwapOption[];
}

/** Record a swap (own row, RLS). The plan view applies it on top of the generated plan. */
export async function recordSwap(userId: string, jobId: string, dayIndex: number, fromSlug: string, toSlug: string): Promise<boolean> {
  const { error } = await supabase.from('plan_swaps').insert({ user_id: userId, job_id: jobId, day_index: dayIndex, from_slug: fromSlug, to_slug: toSlug } as never);
  return !error;
}

type IngredientJoin = { grams: number; ingredients: { name: string; allergens: string[] } | null }[];

/** All recipes with allergens derived from their ingredients: the pool for "Swap meal". */
export async function fetchRecipeLibrary(): Promise<RecipeCandidate[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('slug,name,diet,kcal,protein_g,carbs_g,fat_g,recipe_ingredients(ingredients(allergens))');
  if (error) throw error;
  return ((data ?? []) as unknown as (Omit<RecipeCandidate, 'allergens'> & { recipe_ingredients: IngredientJoin })[]).map(
    ({ recipe_ingredients, ...r }) => ({ ...r, allergens: deriveAllergens((recipe_ingredients ?? []).map((i) => ({ allergens: i.ingredients?.allergens ?? [] }))) }),
  );
}

export interface RecipeDetail {
  slug: string;
  name: string;
  instructions: string | null;
  servings: number;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  allergens: Allergen[];
  ingredients: { name: string; grams: number }[];
}

export async function fetchRecipeDetail(slug: string): Promise<RecipeDetail | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('slug,name,instructions,servings,kcal,protein_g,carbs_g,fat_g,recipe_ingredients(grams,ingredients(name,allergens))')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { recipe_ingredients, ...r } = data as unknown as Omit<RecipeDetail, 'allergens' | 'ingredients'> & { recipe_ingredients: IngredientJoin };
  const rows = (recipe_ingredients ?? []).filter((i) => i.ingredients);
  return {
    ...r,
    allergens: deriveAllergens(rows.map((i) => ({ allergens: i.ingredients!.allergens ?? [] }))),
    ingredients: rows.map((i) => ({ name: i.ingredients!.name, grams: Number(i.grams) })).sort((a, b) => b.grams - a.grams),
  };
}

/** Record a meal swap (own row, RLS). It is the signal for memory; the plan view applies it on top of the generated plan. */
export async function recordMealSwap(userId: string, jobId: string, dayIndex: number, mealIndex: number, fromSlug: string, toSlug: string): Promise<boolean> {
  const { error } = await supabase.from('meal_swaps').insert({ user_id: userId, job_id: jobId, day_index: dayIndex, meal_index: mealIndex, from_slug: fromSlug, to_slug: toSlug } as never);
  return !error;
}

/** Recipes with their ingredients (grams for the whole recipe), for the shopping list. */
export async function fetchShoppingRecipes(slugs: string[]): Promise<Map<string, ShoppingRecipe>> {
  if (!slugs.length) return new Map();
  const { data, error } = await supabase
    .from('recipes')
    .select('slug,servings,recipe_ingredients(grams,ingredients(name,category))')
    .in('slug', slugs);
  if (error) throw error;
  type Row = { slug: string; servings: number; recipe_ingredients: { grams: number; ingredients: { name: string; category: string | null } | null }[] };
  return new Map(
    ((data ?? []) as unknown as Row[]).map((r) => [
      r.slug,
      {
        servings: r.servings,
        ingredients: (r.recipe_ingredients ?? []).filter((i) => i.ingredients).map((i) => ({ name: i.ingredients!.name, category: i.ingredients!.category, grams: Number(i.grams) })),
      },
    ]),
  );
}

export async function fetchCheckedItems(jobId: string): Promise<string[]> {
  const { data, error } = await supabase.from('shopping_list_items').select('label').eq('job_id', jobId).eq('checked', true);
  if (error) throw error;
  return ((data ?? []) as { label: string }[]).map((r) => r.label);
}

export async function setItemChecked(userId: string, jobId: string, label: string, grams: number, checked: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('shopping_list_items')
    .upsert({ user_id: userId, job_id: jobId, label, grams, checked } as never, { onConflict: 'user_id,job_id,label' });
  return !error;
}

export async function clearCheckedItems(jobId: string): Promise<boolean> {
  const { error } = await supabase.from('shopping_list_items').update({ checked: false } as never).eq('job_id', jobId).eq('checked', true);
  return !error;
}
