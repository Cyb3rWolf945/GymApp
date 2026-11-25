import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { en } from '../../src/copy/en';
import { GenerationSteps } from '../../src/plan/GenerationSteps';
import { useUpdatePlan } from '../../src/plan/useUpdatePlan';
import { useTheme } from '../../src/theme';
import { Button, Card, ListItem, Screen, Text } from '../../src/ui';

const t = en.home.update;

/** "Update my plan": rebuilds both plans through the same pipeline, then shows what changed and why. */
export default function UpdatePlan() {
  const { view, retry } = useUpdatePlan();
  const router = useRouter();
  const { spacing } = useTheme();

  useEffect(() => {
    if (view.kind === 'needs_upgrade') router.replace('/paywall');
  }, [view.kind, router]);

  const steps =
    view.kind === 'running'
      ? view.progress.steps
      : [{ id: 'calories' as const, state: 'done' as const }, { id: 'exercises' as const, state: view.kind === 'starting' ? ('active' as const) : ('pending' as const) }, { id: 'meals' as const, state: 'pending' as const }];

  return (
    <Screen
      center={view.kind !== 'done'}
      footer={
        view.kind === 'done' || view.kind === 'error' ? (
          <Button label={t.back} variant={view.kind === 'done' ? 'primary' : 'ghost'} onPress={() => router.replace('/plan')} />
        ) : null
      }
    >
        {view.kind === 'done' ? (
          <>
            <Text variant="display">{t.doneTitle}</Text>
            {view.note ? <Text variant="bodyStrong">{view.note}</Text> : null}
            {view.workout.length === 0 && view.meals.length === 0 ? <Text tone="muted">{t.noChanges}</Text> : null}
            {view.workout.length > 0 ? (
              <Card style={{ gap: spacing.xs }}>
                <Text variant="heading">{t.workoutChanges}</Text>
                {view.workout.map((c, i) => (
                  <ListItem key={`w${i}`} title={`${c.where}: ${c.text}`} subtitle={c.why} />
                ))}
              </Card>
            ) : null}
            {view.meals.length > 0 ? (
              <Card style={{ gap: spacing.xs }}>
                <Text variant="heading">{t.mealChanges}</Text>
                {view.meals.map((c, i) => (
                  <ListItem key={`m${i}`} title={`${c.where}: ${c.text}`} subtitle={c.why} />
                ))}
              </Card>
            ) : null}
          </>
        ) : view.kind === 'error' ? (
          <View style={{ gap: spacing.lg }}>
            <Text variant="display">{t.title}</Text>
            <Text tone="danger" accessibilityRole="alert">{view.reason === 'timeout' ? en.plan.generating.timeout : t.error}</Text>
            <Button label={en.plan.generating.retry} onPress={retry} />
          </View>
        ) : (
          <>
            <Text variant="display">{t.title}</Text>
            <GenerationSteps steps={steps} />
          </>
        )}
    </Screen>
  );
}
