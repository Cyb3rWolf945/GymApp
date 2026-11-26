import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { trackEvent } from '../../src/analytics/track';
import { useAuth } from '../../src/auth/AuthProvider';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { fetchProfileAnswers } from '../../src/profile/api';

/**
 * Entry point: resume where the user left off. Signed out, the answers are kept on the device until sign-up. Signed in
 * (no plan, profile incomplete), what the profile already holds is loaded first, then the quiz resumes at the first missing step.
 */
export default function OnboardingIndex() {
  const { hydrated, answers, update, resumeStep } = useOnboarding();
  const { session, loading } = useAuth();
  const userId = session?.user.id;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated || loading) return;
    if (!userId) return setReady(true);
    let active = true;
    void fetchProfileAnswers(userId).then((saved) => {
      if (!active) return;
      if (saved) update({ ...saved, ...answers }); // this device's newer answers stay on top
      setReady(true);
    });
    return () => {
      active = false;
    };
    // Once, when the state is read.
  }, [hydrated, loading, userId]);

  const step = resumeStep();
  const [tracked, setTracked] = useState(false);
  useEffect(() => {
    if (!ready || !userId || tracked) return;
    setTracked(true);
    trackEvent('onboarding_resumed_signed_in', { step });
  }, [ready, userId, tracked, step]);

  if (!hydrated || loading || !ready) return null;
  return <Redirect href={`/onboarding/${step}`} />;
}
