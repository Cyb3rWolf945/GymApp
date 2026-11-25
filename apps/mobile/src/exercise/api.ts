import type { MuscleRoles, SetRecord } from '@gymapp/shared';
import { muscleRoles } from '@gymapp/shared';
import { supabase } from '../supabase';

export interface ExerciseDetail {
  slug: string;
  name: string;
  equipment: string | null;
  instructions: string | null;
  mediaUrl: string | null;
  roles: MuscleRoles;
}

/** One catalog exercise with the muscles it works (catalog is readable by every signed-in user). */
export async function fetchExerciseDetail(slug: string): Promise<ExerciseDetail | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('slug,name,equipment,instructions,media_url,exercise_muscles(muscle,role)')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as { slug: string; name: string; equipment: string | null; instructions: string | null; media_url: string | null; exercise_muscles: { muscle: string; role: string }[] | null };
  return { slug: r.slug, name: r.name, equipment: r.equipment, instructions: r.instructions, mediaUrl: r.media_url, roles: muscleRoles(r.exercise_muscles) };
}

type Row = { weight_kg: number | null; reps: number | null; logged_at: string; exercises: { slug: string; name: string } | null };

/** The user's own logged sets of one exercise (RLS keeps it to their rows), newest first. */
export async function fetchExerciseSets(userId: string, slug: string): Promise<SetRecord[]> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('weight_kg,reps,logged_at,exercises!inner(slug,name)')
    .eq('user_id', userId)
    .eq('exercises.slug', slug)
    .order('logged_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.exercises?.slug === slug)
    .map((r) => ({ slug, name: r.exercises!.name, weightKg: Number(r.weight_kg ?? 0), reps: Number(r.reps ?? 0), loggedAt: r.logged_at }));
}
