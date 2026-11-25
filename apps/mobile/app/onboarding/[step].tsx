import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { type StepId, getStep, isStepId, nextStepId, prevStepId, progressOf, validateStep } from '@gymapp/shared';
import { trackOnboarding } from '../../src/analytics/track';
import { en } from '../../src/copy/en';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { STEP_BODIES } from '../../src/onboarding/steps';
import { useTheme } from '../../src/theme';
import { Button, ProgressBar, Screen, Text } from '../../src/ui';

const t = en.onboarding;
type StepCopy = { title: string; body?: string; skip?: string; cta?: string };
const copyFor = (id: StepId) => (t.steps as Record<StepId, StepCopy>)[id];

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const { hydrated, answers, update, setStepId, resumeStep } = useOnboarding();
  const router = useRouter();
  const { spacing } = useTheme();
  const [showError, setShowError] = useState(false);
  const id = isStepId(step) ? step : null;

  useEffect(() => {
    if (!id || !hydrated) return;
    setShowError(false);
    setStepId(id);
    trackOnboarding('onboarding_step_viewed', id);
  }, [id, hydrated]);

  if (!hydrated) return null;
  if (!id) return <Redirect href={`/onboarding/${resumeStep()}`} />;

  const def = getStep(id);
  const text = copyFor(id);
  const { step: n, total } = progressOf(answers, id);
  const next = nextStepId(answers, id);
  const prev = prevStepId(answers, id);
  const valid = validateStep(id, answers).ok;
  const Body = STEP_BODIES[id];

  const goNext = (event: 'onboarding_step_completed' | 'onboarding_step_skipped') => {
    trackOnboarding(event, id);
    if (next) router.replace(`/onboarding/${next}`);
    else {
      trackOnboarding('onboarding_finished', id);
      router.replace('/onboarding/generating');
    }
  };
  const onContinue = () => {
    if (!valid) return setShowError(true);
    goNext('onboarding_step_completed');
  };
  const errorText = id === 'consents' ? t.errors.needConsents : id === 'equipment' ? t.errors.pickAtLeastOne : t.errors.pickOne;

  return (
    <Screen
      framed
      center
      keyboardTaps
      header={id !== 'welcome' ? <ProgressBar step={n} total={total} label={t.progress(n, total)} /> : null}
      footer={
        id === 'welcome' ? (
          <Button label={t.haveAccount} variant="ghost" onPress={() => router.replace('/sign-in')} />
        ) : (
          <>
            <Button label={text.cta ?? en.common.continue} onPress={onContinue} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {prev ? <View style={{ flex: 1 }}><Button label={en.common.back} variant="ghost" onPress={() => router.replace(`/onboarding/${prev}`)} /></View> : null}
              {def.skippable ? <View style={{ flex: 1 }}><Button label={text.skip ?? en.common.skip} variant="ghost" onPress={() => goNext('onboarding_step_skipped')} /></View> : null}
            </View>
          </>
        )
      }
    >
      <View style={{ gap: spacing.sm }}>
        <Text variant="display">{text.title}</Text>
        {text.body ? <Text tone="muted">{text.body}</Text> : null}
      </View>
      <View style={{ gap: spacing.lg }}>
        <Body answers={answers} update={update} onContinue={onContinue} />
      </View>
      {showError && !valid ? <Text tone="danger" accessibilityRole="alert">{errorText}</Text> : null}
    </Screen>
  );
}
