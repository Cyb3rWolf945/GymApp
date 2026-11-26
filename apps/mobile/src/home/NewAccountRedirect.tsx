import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { isComplete, missingProfileFields, nextRouteAfterSignIn } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { fetchSavedProfile } from '../plan/api';

/** A signed-in account with no plan: build it, or finish the quiz first when the saved profile is incomplete. */
export function NewAccountRedirect() {
  const { session } = useAuth();
  const { hydrated, answers } = useOnboarding();
  const userId = session?.user.id;
  const [href, setHref] = useState<'/generating' | '/onboarding' | null>(null);

  useEffect(() => {
    if (!userId || !hydrated) return;
    let active = true;
    void fetchSavedProfile(userId).then(
      (row) => {
        const route = nextRouteAfterSignIn({ profileComplete: missingProfileFields(row).length === 0, localAnswersComplete: isComplete(answers), hasPlan: false });
        if (active) setHref(route === 'onboarding' ? '/onboarding' : '/generating');
      },
      () => active && setHref('/generating'), // can't read it: that screen shows the real error and a way to retry
    );
    return () => {
      active = false;
    };
  }, [userId, hydrated]);

  return href ? <Redirect href={href} /> : null;
}
