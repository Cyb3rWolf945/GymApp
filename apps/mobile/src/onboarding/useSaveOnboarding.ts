import { useEffect } from 'react';
import { type PartialAnswers, consentRows, isComplete, toProfileUpdate } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { getAttribution, getTrackingChoice, marketingIds } from '../marketing/tracking';
import { supabase } from '../supabase';
import { useOnboarding } from './OnboardingProvider';

const inflight = new Map<string, Promise<boolean>>();

/**
 * Save the answers to `profiles` (own row, RLS). One save per user at a time, shared by the root hook and the
 * plan screen, which must wait for the profile before asking for a plan. Returns false on failure.
 */
export function saveProfileOnce(userId: string, answers: PartialAnswers): Promise<boolean> {
  const running = inflight.get(userId);
  if (running) return running;
  const p = (async () => {
    // First-touch ad attribution (UTM tags, Facebook ids) and the cookie banner choice travel with the profile.
    // The Facebook ids are only kept if the visitor accepted tracking; UTM tags are plain campaign names.
    const choice = await getTrackingChoice();
    const { fbc, fbp, ...tags } = await getAttribution();
    const attribution = choice === 'accepted' ? { ...tags, ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}), ...((await marketingIds()) ?? {}) } : tags;
    const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...toProfileUpdate(answers), attribution } as never, { onConflict: 'user_id' });
    if (error) return false;
    // Consent records (what was accepted, which version of the text, when). Duplicates are ignored, so a retry is safe.
    if (!answers.consents) return true;
    const marketing = choice === null ? null : choice === 'accepted';
    const { error: consentError } = await supabase
      .from('consent_records')
      .upsert(consentRows(userId, answers.consents, new Date(), marketing) as never, { onConflict: 'user_id,kind,version', ignoreDuplicates: true });
    return !consentError;
  })().finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

/** Once the user is signed in and the answers are complete, save them to `profiles` and drop the local copy. */
export function useSaveOnboarding(): void {
  const { session } = useAuth();
  const { hydrated, answers, clear } = useOnboarding();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !hydrated || !isComplete(answers)) return;
    void saveProfileOnce(userId, answers).then((ok) => {
      // On failure keep the local copy: the next launch tries again.
      if (ok) void clear();
    });
  }, [userId, hydrated, answers, clear]);
}
