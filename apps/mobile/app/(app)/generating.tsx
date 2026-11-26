import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { en } from '../../src/copy/en';
import { GenerationSteps } from '../../src/plan/GenerationSteps';
import { useFeedback } from '../../src/motion';
import { useGeneration } from '../../src/plan/useGeneration';
import { useTheme } from '../../src/theme';
import { Button, Screen, Text } from '../../src/ui';

const t = en.plan.generating;

/** Screen 14: starts the plan jobs and shows real progress until both are done. */
export default function Generating() {
  const { view, retry } = useGeneration();
  const router = useRouter();
  const feedback = useFeedback();
  const { spacing } = useTheme();

  useEffect(() => {
    if (view.kind === 'done') {
      feedback('plan_ready'); // the success tap on a phone, then the preview
      router.replace('/preview');
    }
    if (view.kind === 'needs_trial') router.replace('/paywall');
  }, [view.kind, router, feedback]);

  const steps =
    view.kind === 'running'
      ? view.progress.steps
      : [{ id: 'calories' as const, state: 'done' as const }, { id: 'exercises' as const, state: view.kind === 'starting' ? ('active' as const) : ('pending' as const) }, { id: 'meals' as const, state: 'pending' as const }];

  const error =
    view.kind === 'error'
      ? view.reason === 'timeout'
        ? t.timeout
        : view.reason === 'profile'
          ? en.onboarding.errors.saveProfile
          : en.errors.generatePlan
      : null;

  return (
    <Screen center framed>
      <Text variant="display">{t.title}</Text>
      {error ? (
        <View style={{ gap: spacing.lg }}>
          <Text tone="danger" accessibilityRole="alert">{error}</Text>
          <Button label={t.retry} onPress={retry} />
        </View>
      ) : (
        <GenerationSteps steps={steps} />
      )}
    </Screen>
  );
}
