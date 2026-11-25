import { Redirect } from 'expo-router';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';

/** Entry point: resume where the user left off (answers are kept on the device until sign-up). */
export default function OnboardingIndex() {
  const { hydrated, resumeStep } = useOnboarding();
  if (!hydrated) return null;
  return <Redirect href={`/onboarding/${resumeStep()}`} />;
}
