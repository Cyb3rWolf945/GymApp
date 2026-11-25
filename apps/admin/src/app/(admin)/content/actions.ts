'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { allIngredientMacros } from '@/lib/data';
import { validateExercise, validateIngredient, validatePromptVersion, validateRecipe } from '@/lib/content';
import { audit, requireAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Redirect back to a list with a short status. Messages are fixed text or our own validation messages. */
function back(path: string, status: { saved?: true; error?: string }): never {
  const q = new URLSearchParams();
  if (status.saved) q.set('saved', '1');
  if (status.error) q.set('error', status.error.slice(0, 240));
  revalidatePath(path);
  redirect(q.size ? `${path}?${q}` : path);
}

const firstError = (errors: Record<string, string>) => Object.values(errors)[0] ?? 'Check the form.';
const idOf = (f: FormData) => {
  const v = String(f.get('id') ?? '');
  return UUID.test(v) ? v : null;
};
const isUnique = (e: { code?: string } | null) => e?.code === '23505';
const isInUse = (e: { code?: string } | null) => e?.code === '23503';

// ---------- exercises

export async function saveExercise(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = validateExercise(formData);
  if (!parsed.ok) back('/content/exercises', { error: firstError(parsed.errors) });
  const v = parsed.value;
  const id = idOf(formData);
  const db = createAdminClient();

  await audit({ adminId: admin.id, action: 'edit_content', target: `exercises:${id ?? v.slug}`, details: { table: 'exercises', op: id ? 'update' : 'create' } });
  const row = { slug: v.slug, name: v.name, equipment: v.equipment, level: v.level, mechanic: v.mechanic, instructions: v.instructions, contraindications: v.contraindications };
  const res = id ? await db.from('exercises').update(row as never).eq('id', id).select('id').single() : await db.from('exercises').insert(row as never).select('id').single();
  if (res.error) back('/content/exercises', { error: isUnique(res.error) ? 'That slug is already used.' : 'Could not save the exercise.' });
  const exerciseId = (res.data as { id: string }).id;

  await db.from('exercise_muscles').delete().eq('exercise_id', exerciseId);
  const muscles = [...v.primary.map((muscle) => ({ muscle, role: 'primary' })), ...v.secondary.map((muscle) => ({ muscle, role: 'secondary' }))];
  const { error } = await db.from('exercise_muscles').insert(muscles.map((m) => ({ exercise_id: exerciseId, ...m })) as never);
  if (error) back('/content/exercises', { error: 'Saved, but the muscles could not be saved. Edit it again.' });
  back('/content/exercises', { saved: true });
}

export async function deleteExercise(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  if (!id) back('/content/exercises', {});
  await audit({ adminId: admin.id, action: 'edit_content', target: `exercises:${id}`, details: { table: 'exercises', op: 'delete' } });
  const { error } = await createAdminClient().from('exercises').delete().eq('id', id);
  back('/content/exercises', error ? { error: isInUse(error) ? 'This exercise is used in plans or workout logs, so it cannot be deleted.' : 'Could not delete it.' } : { saved: true });
}

// ---------- ingredients

export async function saveIngredient(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = validateIngredient(formData);
  if (!parsed.ok) back('/content/ingredients', { error: firstError(parsed.errors) });
  const id = idOf(formData);
  const db = createAdminClient();
  await audit({ adminId: admin.id, action: 'edit_content', target: `ingredients:${id ?? parsed.value.name}`, details: { table: 'ingredients', op: id ? 'update' : 'create' } });
  const res = id ? await db.from('ingredients').update(parsed.value as never).eq('id', id) : await db.from('ingredients').insert(parsed.value as never);
  if (res.error) back('/content/ingredients', { error: isUnique(res.error) ? 'An ingredient with that name already exists.' : 'Could not save the ingredient.' });
  back('/content/ingredients', { saved: true });
}

export async function deleteIngredient(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  if (!id) back('/content/ingredients', {});
  await audit({ adminId: admin.id, action: 'edit_content', target: `ingredients:${id}`, details: { table: 'ingredients', op: 'delete' } });
  const { error } = await createAdminClient().from('ingredients').delete().eq('id', id);
  back('/content/ingredients', error ? { error: isInUse(error) ? 'This ingredient is used in recipes, so it cannot be deleted.' : 'Could not delete it.' } : { saved: true });
}

// ---------- recipes

export async function saveRecipe(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = validateRecipe(formData, await allIngredientMacros());
  if (!parsed.ok) back('/content/recipes', { error: firstError(parsed.errors) });
  const v = parsed.value;
  const id = idOf(formData);
  const db = createAdminClient();
  await audit({ adminId: admin.id, action: 'edit_content', target: `recipes:${id ?? v.slug}`, details: { table: 'recipes', op: id ? 'update' : 'create' } });
  const row = { slug: v.slug, name: v.name, diet: v.diet, servings: v.servings, instructions: v.instructions, kcal: v.kcal, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g };
  const res = id ? await db.from('recipes').update(row as never).eq('id', id).select('id').single() : await db.from('recipes').insert(row as never).select('id').single();
  if (res.error) back('/content/recipes', { error: isUnique(res.error) ? 'That slug is already used.' : 'Could not save the recipe.' });
  const recipeId = (res.data as { id: string }).id;
  await db.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  const { error } = await db.from('recipe_ingredients').insert(v.items.map((i) => ({ recipe_id: recipeId, ...i })) as never);
  if (error) back('/content/recipes', { error: 'Saved, but the ingredients could not be saved. Edit it again.' });
  back('/content/recipes', { saved: true });
}

export async function deleteRecipe(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  if (!id) back('/content/recipes', {});
  await audit({ adminId: admin.id, action: 'edit_content', target: `recipes:${id}`, details: { table: 'recipes', op: 'delete' } });
  const { error } = await createAdminClient().from('recipes').delete().eq('id', id);
  back('/content/recipes', error ? { error: isInUse(error) ? 'This recipe is used in meal plans, so it cannot be deleted.' : 'Could not delete it.' } : { saved: true });
}

// ---------- prompt versions

export async function createPromptVersion(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = validatePromptVersion(formData);
  if (!parsed.ok) back('/content/prompts', { error: firstError(parsed.errors) });
  const db = createAdminClient();
  const { data: last } = await db.from('prompt_versions').select('version').eq('name', parsed.value.name).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = ((last as { version: number } | null)?.version ?? 0) + 1;
  await audit({ adminId: admin.id, action: 'create_prompt_version', target: `prompt:${parsed.value.name}`, details: { version } });
  // New versions start inactive: activating is a separate, audited decision.
  const { error } = await db.from('prompt_versions').insert({ ...parsed.value, version, active: false } as never);
  back('/content/prompts', error ? { error: 'Could not save the version. Try again.' } : { saved: true });
}

export async function activatePromptVersion(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  if (!id) back('/content/prompts', {});
  await audit({ adminId: admin.id, action: 'activate_prompt_version', target: `prompt_version:${id}` });
  const { data, error } = await createAdminClient().rpc('activate_prompt_version', { p_id: id } as never);
  back('/content/prompts', error || data !== true ? { error: 'Could not activate that version.' } : { saved: true });
}
