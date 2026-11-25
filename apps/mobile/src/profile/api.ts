import { type PartialAnswers, answersFromProfile, planOutdatedBy, profileUpdateAfterEdit } from '@gymapp/shared';
import { supabase } from '../supabase';

/** The answers behind the profile: what onboarding stored in `profiles.onboarding`. `null` = could not load. */
export async function fetchProfileAnswers(userId: string): Promise<PartialAnswers | null> {
  const { data, error } = await supabase.from('profiles').select('onboarding').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return answersFromProfile((data as { onboarding?: unknown } | null)?.onboarding);
}

export type SaveResult = { ok: true; planOutdated: boolean } | { ok: false };

/**
 * Save an edit to the own profile row (RLS: `user_id = auth.uid()`), in the same shape onboarding writes.
 * `planOutdated` says whether the change affects the plan (everything except the units).
 */
export async function saveProfileEdit(userId: string, stored: PartialAnswers, edited: PartialAnswers): Promise<SaveResult> {
  let update;
  try {
    update = profileUpdateAfterEdit(stored, edited);
  } catch {
    return { ok: false };
  }
  const { error } = await supabase.from('profiles').update(update as never).eq('user_id', userId);
  if (error) return { ok: false };
  return { ok: true, planOutdated: planOutdatedBy(stored, { ...stored, ...edited }) };
}
