import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { WEEKDAY_LABELS, WorkoutPlanSchema, formatReps, trainingWeekdays } from '@gymapp/shared';
import { useAuth } from '../../../src/auth/AuthProvider';
import { en } from '../../../src/copy/en';
import { PlanGate } from '../../../src/home/PlanGate';
import { type PlanData, usePlanData } from '../../../src/home/usePlanData';
import { type SwapOption, fetchSwapOptions, recordSwap } from '../../../src/plan/api';
import { useTheme } from '../../../src/theme';
import { BottomSheet, Button, Card, ListItem, ResponsiveGrid, Screen, Text, useToast } from '../../../src/ui';

const t = en.home;
const s = t.swap;

interface Target {
  dayIndex: number;
  slug: string;
  name: string;
}

function Plan({ data }: { data: PlanData }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { reload } = usePlanData();
  const toast = useToast();
  const parsed = useMemo(() => WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan), [data]);
  const plan = parsed.success ? parsed.data : null;
  const weekdays = plan ? trainingWeekdays(plan.days.length, data.preferredDays) : [];
  const nameOf = (slug: string) => data.exerciseNames.get(slug) ?? slug;

  const [target, setTarget] = useState<Target | null>(null);
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openSwap = async (tg: Target) => {
    setTarget(tg);
    setOptions(null);
    setError(null);
    try {
      // Don't offer what is already in that day.
      const inDay = plan?.days[tg.dayIndex].exercises.map((e) => e.exerciseSlug) ?? [];
      setOptions(await fetchSwapOptions(tg.slug, data.swapProfile, inDay));
    } catch {
      setError(s.loadError);
    }
  };
  const choose = async (o: SwapOption) => {
    if (!user || !target) return;
    setSaving(true);
    const ok = await recordSwap(user.id, data.workoutJobId, target.dayIndex, target.slug, o.slug);
    setSaving(false);
    if (!ok) return setError(s.saveError);
    setTarget(null);
    toast.show(s.done(o.name), 'success');
    reload();
  };

  return (
    <Screen variant="dashboard">
        <Text variant="display">{t.planTitle}</Text>
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
                onPress={() => void openSwap({ dayIndex: i, slug: e.exerciseSlug, name: nameOf(e.exerciseSlug) })}
                trailing={<Text variant="small" tone="accent">{s.action}</Text>}
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
      <BottomSheet visible={!!target} onClose={() => setTarget(null)} title={target ? s.title(target.name) : undefined} closeLabel={en.common.close}>
        <Text tone="muted">{s.body}</Text>
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        {!options && !error ? <ActivityIndicator color={colors.accent} /> : null}
        {options && options.length === 0 ? <Text>{s.none}</Text> : null}
        {options?.map((o) => (
          <Button key={o.slug} label={s.pick(o.name)} variant="secondary" loading={saving} onPress={() => void choose(o)} />
        ))}
      </BottomSheet>
    </Screen>
  );
}

export default function PlanScreen() {
  return <PlanGate>{(data) => <Plan data={data} />}</PlanGate>;
}
