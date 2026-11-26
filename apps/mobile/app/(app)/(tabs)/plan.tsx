import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { WEEKDAY_LABELS, WorkoutPlanSchema, formatReps, trainingWeekdays } from '@gymapp/shared';
import { FocusFade } from '../../../src/motion';
import { en } from '../../../src/copy/en';
import { PlanGate } from '../../../src/home/PlanGate';
import { PlanOutdatedCard } from '../../../src/profile/PlanOutdatedCard';
import type { PlanData } from '../../../src/home/usePlanData';
import { useTheme } from '../../../src/theme';
import { Button, Card, ListItem, ResponsiveGrid, Screen, Text } from '../../../src/ui';

const t = en.home;

function Plan({ data }: { data: PlanData }) {
  const { spacing } = useTheme();
  const router = useRouter();
  const parsed = useMemo(() => WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan), [data]);
  const plan = parsed.success ? parsed.data : null;
  const weekdays = plan ? trainingWeekdays(plan.days.length, data.preferredDays) : [];
  const nameOf = (slug: string) => data.exerciseNames.get(slug) ?? slug;

  return (
    <Screen variant="dashboard">
        <Text variant="display">{t.planTitle}</Text>
        <PlanOutdatedCard />
        <Card style={{ gap: spacing.sm }}>
          <Text tone="muted">{t.update.hint}</Text>
          <Button label={t.update.action} variant="secondary" onPress={() => router.push('/update-plan')} />
        </Card>
        <ResponsiveGrid gap={spacing.xl}>
        {plan?.days.map((d, i) => (
          <Card key={`${d.name}-${i}`} style={{ gap: spacing.sm }}>
            <Text variant="small" tone="muted">{WEEKDAY_LABELS[weekdays[i]]}</Text>
            <Text variant="heading">{d.name}</Text>
            {d.exercises.map((e) => (
              <ListItem
                key={e.exerciseSlug}
                title={nameOf(e.exerciseSlug)}
                subtitle={`${e.sets} × ${formatReps(e.repsMin, e.repsMax)}`}
                onPress={() => router.push({ pathname: '/exercise/[slug]', params: { slug: e.exerciseSlug, day: String(i) } })}
                trailing={<Text variant="small" tone="accent">{en.exercise.open}</Text>}
              />
            ))}
          </Card>
        ))}
        </ResponsiveGrid>
        {plan ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyStrong">{en.plan.preview.why}</Text>
            <Text tone="muted">{plan.rationale}</Text>
          </View>
        ) : null}
    </Screen>
  );
}

export default function PlanScreen() {
  return (
    <FocusFade>
      <PlanGate>{(data) => <Plan data={data} />}</PlanGate>
    </FocusFade>
  );
}
