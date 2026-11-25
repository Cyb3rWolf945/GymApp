import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WEEKDAY_LABELS, buildToday, dateKey, mealProgress, toggleEaten } from '@gymapp/shared';
import { PastDueBanner } from '../../../src/billing/PastDueBanner';
import { en } from '../../../src/copy/en';
import { loadEaten, saveEaten } from '../../../src/home/eaten';
import { PlanGate } from '../../../src/home/PlanGate';
import type { PlanData } from '../../../src/home/usePlanData';
import { useTheme } from '../../../src/theme';
import { useWorkout } from '../../../src/workout/WorkoutProvider';
import { Button, Card, ListItem, StatTile, Text } from '../../../src/ui';

const t = en.home;

function Today({ data }: { data: PlanData }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
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
  const target = meals ? data.targets?.[meals.dayType]?.kcal : undefined;
  const progress = meals ? mealProgress(meals, eaten, target) : null;
  const n = (v: number) => String(Math.round(v));
  const toggle = (i: number) => {
    const next = toggleEaten(eaten, i);
    setEaten(next);
    void saveEaten(day, next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Text variant="display">{t.title}</Text>
        <PastDueBanner />

        {workout?.kind === 'workout' ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{workout.dayName}</Text>
            <Text tone="muted">{t.workoutMeta(workout.exercises.length, workout.minutes)}</Text>
            {workout.exercises.map((e) => (
              <ListItem key={e.slug} title={e.name} subtitle={`${e.sets} × ${e.reps}`} />
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

        {meals && progress ? (
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
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TodayScreen() {
  return <PlanGate>{(data) => <Today data={data} />}</PlanGate>;
}
