import { useEffect, useRef } from 'react';
import { isComplete, toProfileUpdate } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabase';
import { useOnboarding } from './OnboardingProvider';

/** Once the user is signed in and the answers are complete, save them to `profiles` and drop the local copy. */
export function useSaveOnboarding(): void {
  const { session } = useAuth();
  const { hydrated, answers, clear } = useOnboarding();
  const saving = useRef(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !hydrated || saving.current || !isComplete(answers)) return;
    saving.current = true;
    void (async () => {
      const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...toProfileUpdate(answers) } as never, { onConflict: 'user_id' });
      // On failure keep the local copy: the next launch tries again.
      if (!error) await clear();
      saving.current = false;
    })();
  }, [userId, hydrated, answers, clear]);
}
