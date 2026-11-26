import { useEffect, useMemo, useRef } from 'react';
import { Animated, type ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { type StepId, getStep, isStepId, nextStepId, prevStepId, progressOf, validateStep } from '@gymapp/shared';
import { trackOnboarding } from '../../src/analytics/track';
import { useAuth } from '../../src/auth/AuthProvider';
import { en } from '../../src/copy/en';
import { FieldErrorsProvider, useStepErrors } from '../../src/onboarding/FieldErrors';
import { FadeSlideIn, createTapLock, staggerDelay, stepDirection, useConfirmPulse, useReducedMotion, useShake } from '../../src/motion';
import { LivePreview } from '../../src/onboarding/LivePreview';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { STEP_BODIES } from '../../src/onboarding/steps';
import { useTheme } from '../../src/theme';
import { Button, ProgressBar, Screen, Text } from '../../src/ui';

const t = en.onboarding;
/** The step shown before this one, so a step knows whether it is entering going forward or back. Lives as long as the app. */
let previousStep: StepId | null = null;
type StepCopy = { title: string; body?: string; skip?: string; cta?: string };
const copyFor = (id: StepId) => (t.steps as Record<StepId, StepCopy>)[id];

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const { hydrated, answers, update, setStepId, resumeStep } = useOnboarding();
  const router = useRouter();
  const { session } = useAuth();
  const { spacing } = useTheme();
  const id = isStepId(step) ? step : null;
  const reduced = useReducedMotion();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const shake = useShake();
  const confirm = useConfirmPulse();
  // One navigation per screen: extra taps while the next step comes in are ignored.
  const lock = useRef(createTapLock()).current;
  // Read the previous step once, when this screen first appears, then remember this one for the next.
  const direction = useMemo(() => {
    if (!id) return 'none' as const;
    const d = stepDirection(previousStep, id);
    previousStep = id;
    return d;
  }, [id]);

  const stepErrors = useStepErrors(id ?? 'welcome', answers, scrollRef);

  useEffect(() => {
    if (!id || !hydrated) return;
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
      // Signed in there is no account to create: straight to building the plan (the answers are saved from there).
      router.replace(session ? '/generating' : '/onboarding/generating');
    }
  };
  const onContinue = () => {
    if (lock.locked) return;
    if (!valid) {
      stepErrors.reveal(); // a message under each field that is wrong; the first one is scrolled to and focused
      shake.run();
      return;
    }
    if (!lock.take()) return;
    confirm.run(() => goNext('onboarding_step_completed')); // a short pulse, then the next step comes in
  };
  const onSkip = () => {
    if (lock.take()) goNext('onboarding_step_skipped');
  };
  const onBack = (to: StepId) => {
    if (lock.take()) router.replace(`/onboarding/${to}`);
  };

  return (
    <Screen
      framed
      center
      keyboardTaps
      scrollRef={scrollRef}
      header={id !== 'welcome' ? <ProgressBar step={n} total={total} label={t.progress(n, total)} /> : null}
      footer={
        id === 'welcome' ? (
          session ? null : <Button label={t.haveAccount} variant="ghost" onPress={() => router.replace('/sign-in?mode=login')} />
        ) : (
          <>
            <Button label={text.cta ?? en.common.continue} onPress={onContinue} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {prev ? <View style={{ flex: 1 }}><Button label={en.common.back} variant="ghost" onPress={() => onBack(prev)} /></View> : null}
              {def.skippable ? <View style={{ flex: 1 }}><Button label={text.skip ?? en.common.skip} variant="ghost" onPress={onSkip} /></View> : null}
            </View>
          </>
        )
      }
    >
      {/* Title, text and options come in one after another (a short stagger), sliding the way you are going. */}
      <FadeSlideIn direction={direction}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="display">{text.title}</Text>
          {text.body ? <Text tone="muted">{text.body}</Text> : null}
        </View>
      </FadeSlideIn>
      <FadeSlideIn direction={direction} delay={staggerDelay(1, reduced)}>
        <Animated.View style={[shake.style, confirm.style]}>
          <View style={{ gap: spacing.lg }}>
            <FieldErrorsProvider value={{ messages: stepErrors.messages, register: stepErrors.register }}>
              <Body answers={answers} update={update} onContinue={onContinue} />
            </FieldErrorsProvider>
          </View>
        </Animated.View>
      </FadeSlideIn>
      {id !== 'welcome' && id !== 'consents' ? <LivePreview answers={answers} /> : null}
      {stepErrors.generic ? (
        <FadeSlideIn>
          <Text tone="danger" accessibilityRole="alert">{stepErrors.generic}</Text>
        </FadeSlideIn>
      ) : null}
    </Screen>
  );
}
