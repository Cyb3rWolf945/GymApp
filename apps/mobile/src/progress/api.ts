import type { MuscleSet, SetRecord, WeightPoint } from '@gymapp/shared';
import { supabase } from '../supabase';

const DAY = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * DAY).toISOString();
export const todayKey = () => new Date().toISOString().slice(0, 10);

/** Body weight readings of the last 120 days (own rows, RLS). */
export async function fetchWeights(userId: string): Promise<WeightPoint[]> {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('measured_on,weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .gte('measured_on', since(120).slice(0, 10))
    .order('measured_on');
  if (error) throw error;
  return ((data ?? []) as { measured_on: string; weight_kg: number }[]).map((r) => ({ date: r.measured_on, kg: Number(r.weight_kg) }));
}

/** One reading per day: logging again on the same day replaces it. */
export async function logWeight(userId: string, kg: number, date = todayKey()): Promise<boolean> {
  const { error } = await supabase.from('body_metrics').upsert({ user_id: userId, measured_on: date, weight_kg: kg } as never, { onConflict: 'user_id,measured_on' });
  return !error;
}

type Row = {
  weight_kg: number | null;
  reps: number | null;
  logged_at: string;
  exercises: { slug: string; name: string; exercise_muscles: { muscle: string; role: 'primary' | 'secondary' }[] } | null;
};

/** Logged sets of the last 180 days with their exercise and the muscles it works. Feeds the PRs, trends and the muscle map. */
export async function fetchSets(userId: string): Promise<{ records: SetRecord[]; muscleSets: MuscleSet[] }> {
  const { data, error } = await supabase
    .from('set_logs')
    .select('weight_kg,reps,logged_at,exercises(slug,name,exercise_muscles(muscle,role))')
    .eq('user_id', userId)
    .eq('is_warmup', false)
    .gte('logged_at', since(180))
    .order('logged_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.exercises);
  return {
    records: rows.map((r) => ({ slug: r.exercises!.slug, name: r.exercises!.name, weightKg: Number(r.weight_kg ?? 0), reps: Number(r.reps ?? 0), loggedAt: r.logged_at })),
    muscleSets: rows.map((r) => ({ slug: r.exercises!.slug, name: r.exercises!.name, loggedAt: r.logged_at, muscles: r.exercises!.exercise_muscles ?? [] })),
  };
}
