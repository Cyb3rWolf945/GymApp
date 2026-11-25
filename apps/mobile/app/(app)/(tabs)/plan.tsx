import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WEEKDAY_LABELS, WorkoutPlanSchema, formatReps, trainingWeekdays } from '@gymapp/shared';
import { en } from '../../../src/copy/en';
import { PlanGate } from '../../../src/home/PlanGate';
import type { PlanData } from '../../../src/home/usePlanData';
import { useTheme } from '../../../src/theme';
import { Card, ListItem, Text } from '../../../src/ui';

const t = en.home;

function Plan({ data }: { data: PlanData }) {
  const { colors, spacing } = useTheme();
  const parsed = useMemo(() => WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan), [data]);
  const plan = parsed.success ? parsed.data : null;
  const weekdays = plan ? trainingWeekdays(plan.days.length, data.preferredDays) : [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Text variant="display">{t.planTitle}</Text>
        {plan?.days.map((d, i) => (
          <Card key={`${d.name}-${i}`} style={{ gap: spacing.sm }}>
            <Text variant="small" tone="muted">{WEEKDAY_LABELS[weekdays[i]]}</Text>
            <Text variant="heading">{d.name}</Text>
            {d.exercises.map((e) => (
              <ListItem key={e.exerciseSlug} title={data.exerciseNames.get(e.exerciseSlug) ?? e.exerciseSlug} subtitle={`${e.sets} × ${formatReps(e.repsMin, e.repsMax)}`} />
            ))}
          </Card>
        ))}
        {plan ? <Text tone="muted">{plan.rationale}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PlanScreen() {
  return <PlanGate>{(data) => <Plan data={data} />}</PlanGate>;
}
