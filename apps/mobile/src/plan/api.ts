import { type JobRow, type PlanKind, type RecipeCandidate, PLAN_KINDS, expandEquipment, isEntitled } from '@gymapp/shared';
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
