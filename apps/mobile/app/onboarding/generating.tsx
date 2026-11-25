import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { buildPlanInputs, isComplete, toProfileUpdate } from '@gymapp/shared';
import { en } from '../../src/copy/en';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { GenerationSteps } from '../../src/plan/GenerationSteps';
import { useTheme } from '../../src/theme';
import { Button, Screen, Text } from '../../src/ui';

const t = en.plan.generating;

/** Screen 14, before the account exists: the calorie calc runs right here; the plan needs an account. */
export default function GeneratingSignedOut() {
  const { hydrated, answers } = useOnboarding();
  const router = useRouter();
  const { spacing } = useTheme();

  const kcal = useMemo(() => {
    if (!isComplete(answers)) return null;
    try {
      const p = toProfileUpdate(answers);
      return buildPlanInputs(p).targets.rest.kcal;
    } catch {
      return null;
    }
  }, [answers]);

  if (!hydrated) return null;
  if (!isComplete(answers)) return <Redirect href="/onboarding" />;

  return (
    <Screen center framed footer={<Button label={t.accountCta} onPress={() => router.replace('/sign-in')} />}>
      <Text variant="display">{t.title}</Text>
      <GenerationSteps
        steps={[{ id: 'calories', state: 'done' }, { id: 'exercises', state: 'pending' }, { id: 'meals', state: 'pending' }]}
        caloriesNote={kcal ? t.caloriesDone(kcal.toLocaleString('en-US')) : undefined}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">{t.accountTitle}</Text>
        <Text tone="muted">{t.accountBody}</Text>
      </View>
    </Screen>
  );
}
