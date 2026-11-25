import AsyncStorage from '@react-native-async-storage/async-storage';
import { workoutsDoneInWeek, type CheckinInput } from '@gymapp/shared';
import { supabase } from '../supabase';

/** `week_start` of the newest check-in already sent (own rows, RLS), or null. */
export async function lastCheckinWeek(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('weekly_checkins').select('week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(1);
  if (error) throw error;
  return ((data ?? []) as { week_start: string }[])[0]?.week_start ?? null;
}

/** Last body weight entry, to prefill the form. */
export async function lastWeight(userId: string): Promise<number | null> {
  const { data } = await supabase.from('body_metrics').select('weight_kg').eq('user_id', userId).not('weight_kg', 'is', null).order('measured_on', { ascending: false }).limit(1);
  const kg = ((data ?? []) as { weight_kg: number }[])[0]?.weight_kg;
  return kg === undefined ? null : Number(kg);
}

/** Finished workouts since the Monday `weekStart`, to prefill "how many did you do". */
export async function workoutsThisWeek(userId: string, weekStart: string): Promise<number> {
  const since = new Date(`${weekStart}T00:00:00`).toISOString();
  const { data } = await supabase.from('workout_sessions').select('finished_at').eq('user_id', userId).not('finished_at', 'is', null).gte('finished_at', since);
  return workoutsDoneInWeek(((data ?? []) as { finished_at: string }[]).map((r) => r.finished_at), weekStart);
}

export async function sendCheckin(input: CheckinInput): Promise<boolean> {
  const { error } = await supabase.functions.invoke('weekly-checkin', { body: input });
  return !error;
}

// "Not now" hides this week's card. One value per user: the week_start that was dismissed.
const key = (userId: string) => `fuelift.checkin_dismissed.${userId}`;
const listeners = new Set<() => void>();
export const onCheckinChanged = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notifyCheckinChanged = (): void => listeners.forEach((fn) => fn());
export const dismissedWeek = (userId: string): Promise<string | null> => AsyncStorage.getItem(key(userId));
export async function dismissCheckin(userId: string, weekStart: string): Promise<void> {
  await AsyncStorage.setItem(key(userId), weekStart);
  notifyCheckinChanged();
}
