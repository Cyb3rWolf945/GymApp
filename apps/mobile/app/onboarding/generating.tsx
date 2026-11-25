import { useEffect, useMemo, useReducer } from 'react';
import { Redirect } from 'expo-router';
import { buildPlanInputs, isComplete, toProfileUpdate } from '@gymapp/shared';
import { trackEvent } from '../../src/analytics/track';
import { SignInForm } from '../../src/auth/SignInForm';
import { en } from '../../src/copy/en';
import { FadeSlideIn } from '../../src/motion';
import { ACCOUNT_MODAL_DELAY_MS, accountModalReducer } from '../../src/onboarding/accountModal';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { GenerationSteps } from '../../src/plan/GenerationSteps';
import { BottomSheet, Button, Screen, Text } from '../../src/ui';

const t = en.plan.generating;

/**
 * Screen 14, before the account exists: the calorie calc runs right here and the checklist shows the plan being built.
 * After a short moment an account modal opens over it (the plan needs an account). Answers stay in the onboarding
 * store, so nothing is re-entered; once signed in, the signed-in generation flow takes over.
 */
export default function GeneratingSignedOut() {
  const { hydrated, answers } = useOnboarding();
  const [modal, dispatch] = useReducer(accountModalReducer, 'waiting');

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
  }, [hydrated]);

  const open = modal === 'open';
  useEffect(() => {
    if (open) trackEvent('account_modal_view', {});
  }, [open]);

  if (!hydrated) return null;
  if (!isComplete(answers)) return <Redirect href="/onboarding" />;

  return (
    <Screen
      center
      framed
      footer={modal === 'closed' ? <Button label={t.accountCta} onPress={() => dispatch('reopen')} /> : null}
    >
      {/* Arrives with a fade, as if the last question dissolves into the plan being built. */}
      <FadeSlideIn>
        <Text variant="display">{t.title}</Text>
      </FadeSlideIn>
      <GenerationSteps
        steps={[{ id: 'calories', state: 'done' }, { id: 'exercises', state: 'pending' }, { id: 'meals', state: 'pending' }]}
        caloriesCount={kcal ? { kcal, format: (n) => t.caloriesDone(n.toLocaleString('en-US')) } : undefined}
      />
      {/* Tapping the dimmed background does nothing; Escape (web) or the back button (Android) closes it. */}
      <BottomSheet
        visible={open}
        onClose={() => dispatch('dismiss')}
        title={t.accountTitle}
        closeLabel={en.common.close}
        dismissOnBackdrop={false}
        dialogFrom="medium"
        dialogMaxWidth={420}
      >
        <Text tone="muted">{t.accountBody}</Text>
        <SignInForm showHeading={false} onMethod={(method) => trackEvent('signin_method_chosen', { method })} />
      </BottomSheet>
    </Screen>
  );
}
