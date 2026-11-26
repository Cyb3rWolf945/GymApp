import { useEffect, useMemo } from 'react';
import { Redirect } from 'expo-router';
import { buildPlanInputs, isComplete, toProfileUpdate } from '@gymapp/shared';
import { en } from '../../src/copy/en';
import { FadeSlideIn } from '../../src/motion';
import { ACCOUNT_MODAL_DELAY_MS } from '../../src/onboarding/accountModal';
import { useAccountModal } from '../../src/onboarding/AccountModalProvider';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { BuildingOrb } from '../../src/plan/BuildingOrb';
import { GenerationSteps } from '../../src/plan/GenerationSteps';
import { Button, Screen, Text } from '../../src/ui';

const t = en.plan.generating;

/**
 * Screen 14, before the account exists: the calorie calc runs right here and the checklist shows the plan being built.
 * After a short moment the account modal opens over it (the plan needs an account; step 2 offers the plans). Answers stay in the onboarding
 * store, so nothing is re-entered; once signed in, the signed-in generation flow takes over.
 */
export default function GeneratingSignedOut() {
  const { hydrated, answers } = useOnboarding();
  const { state: modal, dispatch } = useAccountModal();

  const kcal = useMemo(() => {
    if (!isComplete(answers)) return null;
    try {
      const p = toProfileUpdate(answers);
      return buildPlanInputs(p).targets.rest.kcal;
    } catch {
      return null;
    }
  }, [answers]);

  // Let people see the calories step first, then open the modal.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => dispatch('delay_passed'), ACCOUNT_MODAL_DELAY_MS);
    return () => clearTimeout(id);
  }, [hydrated, dispatch]);

  if (!hydrated) return null;
  if (!isComplete(answers)) return <Redirect href="/onboarding" />;

  return (
    <Screen
      center
      framed
      footer={modal === 'closed_account' ? <Button label={t.accountCta} onPress={() => dispatch('reopen')} /> : null}
    >
      {/* Arrives with a fade, as if the last question dissolves into the plan being built. */}
      <FadeSlideIn>
        <Text variant="display">{t.title}</Text>
      </FadeSlideIn>
      <BuildingOrb />
      <GenerationSteps
        steps={[{ id: 'calories', state: 'done' }, { id: 'exercises', state: 'pending' }, { id: 'meals', state: 'pending' }]}
        caloriesCount={kcal ? { kcal, format: (n) => t.caloriesDone(n.toLocaleString('en-US')) } : undefined}
      />
      {/* The account / plan modal itself lives in AccountModalProvider (above the sign-in route guard). */}
    </Screen>
  );
}
