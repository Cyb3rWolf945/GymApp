import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { WEEKDAY_LABELS, WorkoutPlanSchema, buildToday, dateKey, mealProgress, toggleEaten } from '@gymapp/shared';
import { PastDueBanner } from '../../../src/billing/PastDueBanner';
import { WeeklyCheckinCard } from '../../../src/checkin/WeeklyCheckinCard';
import { WeeklyChangesCard } from '../../../src/plan/WeeklyChangesCard';
import { PlanOutdatedCard } from '../../../src/profile/PlanOutdatedCard';
import { en } from '../../../src/copy/en';
import { loadEaten, saveEaten } from '../../../src/home/eaten';
import { PlanGate } from '../../../src/home/PlanGate';
import type { PlanData } from '../../../src/home/usePlanData';
import { useBreakpoint, useTheme } from '../../../src/theme';
import { useWorkout } from '../../../src/workout/WorkoutProvider';
import { Button, Card, ListItem, Screen, StatTile, Text } from '../../../src/ui';

const t = en.home;

function Today({ data }: { data: PlanData }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const wide = useBreakpoint() !== 'compact';
  const { active, start } = useWorkout();
  const now = useMemo(() => new Date(), []);
  const day = dateKey(now);
  const [eaten, setEaten] = useState<number[]>([]);
  useEffect(() => {
    void loadEaten(day).then(setEaten);
  }, [day]);

  const view = useMemo(
    () => buildToday({ workoutResult: data.workoutResult, nutritionResult: data.nutritionResult, preferredDays: data.preferredDays, date: now, exerciseNames: data.exerciseNames, recipes: data.recipes }),
    [data, now],
  );
  const { workout, meals } = view;
  const plannedDays = useMemo(() => {
    const w = WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan);
    return w.success ? w.data.days.length : 0;
  }, [data]);
  const target = meals ? data.targets?.[meals.dayType]?.kcal : undefined;
  const progress = meals ? mealProgress(meals, eaten, target) : null;
  const n = (v: number) => String(Math.round(v));
  const toggle = (i: number) => {
    const next = toggleEaten(eaten, i);
    setEaten(next);
    void saveEaten(day, next);
  };

  return (
    <Screen variant="dashboard">
      <Text variant="display">{t.title}</Text>
      <PastDueBanner />
      <PlanOutdatedCard />
      <WeeklyChangesCard />
      <WeeklyCheckinCard workoutDays={plannedDays} preferredDays={data.preferredDays} />
      {/* Workout and meals side by side from `medium` up, stacked on phones. */}
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.xl }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: spacing.xl }}>
        {workout?.kind === 'workout' ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{workout.dayName}</Text>
            <Text tone="muted">{t.workoutMeta(workout.exercises.length, workout.minutes)}</Text>
            {workout.exercises.map((e) => (
              <ListItem key={e.slug} title={e.name} subtitle={`${e.sets} × ${e.reps}`} onPress={() => router.push({ pathname: '/exercise/[slug]', params: { slug: e.slug } })} />
            ))}
            <Button
              label={active && !active.finishedAt ? en.workout.resume : t.startWorkout}
              onPress={async () => {
                if (!active || active.finishedAt) {
                  await start({ dayName: workout.dayName, exercises: workout.exercises.map((e) => ({ slug: e.slug, name: e.name, sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, restSeconds: e.restSeconds })) });
                }
                router.push('/workout');
              }}
            />
          </Card>
        ) : workout?.kind === 'rest' ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{t.restTitle}</Text>
            <Text tone="muted">{t.restBody}</Text>
            {workout.next ? <Text variant="bodyStrong">{t.nextWorkout(WEEKDAY_LABELS[workout.next.weekday], workout.next.dayName)}</Text> : null}
          </Card>
        ) : null}
        </View>

        {meals && progress ? (
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="heading">{t.mealsTitle}</Text>
              <Text variant="small" tone="muted">{t.mealsProgress(progress.eatenCount, progress.total)}</Text>
            </View>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }} style={{ height: 6, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}>
              <View style={{ width: `${progress.fraction * 100}%`, height: 6, borderRadius: radius.sm, backgroundColor: colors.accent }} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={en.plan.preview.kcal} value={n(progress.eaten.kcal)} hint={target ? t.target(target) : `of ${n(meals.totals.kcal)} kcal`} />
              <StatTile label={en.plan.preview.protein} value={n(progress.eaten.proteinG)} unit="g" hint={data.targets ? `of ${data.targets[meals.dayType].proteinG} g` : undefined} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={en.plan.preview.carbs} value={n(progress.eaten.carbsG)} unit="g" hint={data.targets ? `of ${data.targets[meals.dayType].carbsG} g` : undefined} />
              <StatTile label={en.plan.preview.fat} value={n(progress.eaten.fatG)} unit="g" hint={data.targets ? `of ${data.targets[meals.dayType].fatG} g` : undefined} />
            </View>
            {meals.meals.map((m, i) => (
              <ListItem
                key={`${m.name}-${i}`}
                title={m.name}
                subtitle={`${m.recipe} · ${m.kcal} kcal`}
                onPress={() => toggle(i)}
                trailing={<Text variant="small" tone={eaten.includes(i) ? 'accent' : 'muted'}>{eaten.includes(i) ? t.unmarkEaten : t.markEaten}</Text>}
              />
            ))}
          </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

export default function TodayScreen() {
  return <PlanGate>{(data) => <Today data={data} />}</PlanGate>;
}
