import { type SessionInfo, type SessionSet } from '@gymapp/shared';
import { supabase } from '../supabase';

interface SetRow {
  id: string;
  exercise_id: string;
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  logged_at: string;
  exercises: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

/** One workout and every set logged in it (own rows, RLS). `null` = it does not exist (any more). Throws when it can't be loaded. */
export async function fetchSession(sessionId: string): Promise<{ session: SessionInfo; sets: SessionSet[] } | null> {
  const { data: s, error } = await supabase.from('workout_sessions').select('id,day_name,started_at,finished_at,rating').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  if (!s) return null;
  const row = s as { id: string; day_name: string | null; started_at: string; finished_at: string | null; rating: number | null };
  const { data: sets, error: setsError } = await supabase
    .from('set_logs')
    .select('id,exercise_id,set_index,reps,weight_kg,rpe,logged_at,exercises(slug,name)')
    .eq('session_id', sessionId)
    .order('logged_at');
  if (setsError) throw setsError;
  return {
    session: { id: row.id, dayName: row.day_name, startedAt: row.started_at, finishedAt: row.finished_at, rating: row.rating },
    sets: ((sets ?? []) as unknown as SetRow[]).map((r) => {
      const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises;
      return { id: r.id, exerciseId: r.exercise_id, slug: ex?.slug ?? r.exercise_id, name: ex?.name ?? ex?.slug ?? '', setIndex: r.set_index, reps: r.reps, weightKg: r.weight_kg === null ? null : Number(r.weight_kg), rpe: r.rpe === null ? null : Number(r.rpe), loggedAt: r.logged_at };
    }),
  };
}
