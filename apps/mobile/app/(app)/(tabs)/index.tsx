import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { INLINE_OPTIONS, type MealOption, NutritionPlanSchema, WEEKDAY_LABELS, WorkoutPlanSchema, buildToday, clearEatenSlot, dateKey, mealKind, mealProgress, pickLine, seedOf, toggleEaten, usedStarterPlan } from '@gymapp/shared';
import { trackEvent } from '../../../src/analytics/track';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useCoachStyle } from '../../../src/coach/useCoachStyle';
import { PastDueBanner } from '../../../src/billing/PastDueBanner';
import { WeeklyCheckinCard } from '../../../src/checkin/WeeklyCheckinCard';
import { WeeklyChangesCard } from '../../../src/plan/WeeklyChangesCard';
import { PlanOutdatedCard } from '../../../src/profile/PlanOutdatedCard';
import { FocusFade } from '../../../src/motion';
import { en } from '../../../src/copy/en';
import { loadEaten, saveEaten } from '../../../src/home/eaten';
import { MealOptions } from '../../../src/home/MealOptions';
import { newRowId, optionsForSlot, useOptionSources } from '../../../src/home/useMealOptions';
import { deleteMealSwap, recordMealSwap } from '../../../src/plan/api';
import { WorkoutHero } from '../../../src/home/WorkoutHero';
import { PlanGate } from '../../../src/home/PlanGate';
import { type PlanData, usePlanData } from '../../../src/home/usePlanData';
import { useBreakpoint, useTheme } from '../../../src/theme';
import { useWorkout } from '../../../src/workout/WorkoutProvider';
import { Button, Card, FillBar, ListItem, Screen, StatTile, Text, useToast } from '../../../src/ui';
import { FadeSlideIn, Reveal, useFirstVisit } from '../../../src/motion';

const t = en.home;

function Today({ data }: { data: PlanData }) {
  const { spacing } = useTheme();
  const router = useRouter();
  const wide = useBreakpoint() !== 'compact';
  const { active, start } = useWorkout();
  const { style } = useCoachStyle();
  const { user } = useAuth();
  const { reload } = usePlanData();
  const toast = useToast();
  const [swapping, setSwapping] = useState(false);
  const sources = useOptionSources(data.nutritionJobId);
  const first = useFirstVisit('today');
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

  // Where today's meals sit in the plan (the same day the card shows), to find each slot's recipe and record a swap against it.
  const slots = useMemo(() => {
    const parsed = NutritionPlanSchema.safeParse((data.nutritionResult as { plan?: unknown } | null)?.plan);
    if (!parsed.success || !meals) return [];
    const dayIndex = Math.max(0, parsed.data.days.findIndex((d) => d.dayType === meals.dayType));
    return parsed.data.days[dayIndex].meals.map((m, mealIndex) => ({ dayIndex, mealIndex, slug: m.recipeSlug, slotName: m.name, portions: m.portions }));
  }, [data, meals]);
  const source = usedStarterPlan(data.nutritionResult) ? 'template' : 'planner';
  const optionsFor = (i: number): { options: MealOption[]; all: MealOption[] } => {
    const s = slots[i];
    const cur = s ? data.recipes.find((r) => r.slug === s.slug) : undefined;
    if (!s || !cur) return { options: [], all: [] };
    const all = optionsForSlot(sources, user?.id, { current: { slug: s.slug, kcal: cur.kcal, portions: s.portions, proteinG: cur.protein_g }, slotName: s.slotName, profile: data.mealProfile, usedInDay: slots.map((x) => x.slug) });
    return { options: all.slice(0, INLINE_OPTIONS), all };
  };
  const seenSlots = useMemo(() => new Set<number>(), []);
  const chooseOption = async (i: number, o: MealOption) => {
    const s = slots[i];
    if (!user || !s || swapping) return;
    setSwapping(true);
    const id = newRowId();
    const ok = await recordMealSwap(user.id, data.nutritionJobId, s.dayIndex, s.mealIndex, s.slug, o.recipe.slug, o.portions, id);
    setSwapping(false);
    if (!ok) return toast.show(t.swapFailed, 'error');
    trackEvent('meal_swapped', { placement: 'today', slot: mealKind(s.slotName), source });
    // A new meal is not eaten yet.
    const { eaten: next, cleared } = clearEatenSlot(eaten, i);
    if (cleared) {
      setEaten(next);
      void saveEaten(day, next);
    }
    toast.show(cleared ? t.swappedNotEaten(o.recipe.name) : t.swappedTo(o.recipe.name), 'success', {
      label: t.undoSwap,
      onPress: () => {
        void deleteMealSwap(id).then((undone) => {
          if (undone) toast.show(t.undoneSwap, 'info');
          reload();
        });
      },
    });
    reload();
  };
  const toggle = (i: number) => {
    const next = toggleEaten(eaten, i);
    setEaten(next);
    void saveEaten(day, next);
  };

  return (
    <Screen variant="dashboard">
      <Text variant="display">{t.title}</Text>
      <Text tone="muted">{pickLine(en.coach.greeting, style, seedOf(day))}</Text>
      <PastDueBanner />
      <PlanOutdatedCard />
      <WeeklyChangesCard />
      <WeeklyCheckinCard workoutDays={plannedDays} preferredDays={data.preferredDays} />
      {/* Workout and meals side by side from `medium` up, stacked on phones. */}
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.xl }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: spacing.xl }}>
        <Reveal first={first} index={1}>
        {workout?.kind === 'workout' ? (
          <WorkoutHero dayName={workout.dayName} meta={t.workoutMeta(workout.exercises.length, workout.minutes)}>
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
          </WorkoutHero>
        ) : workout?.kind === 'rest' ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{t.restTitle}</Text>
            <Text tone="muted">{t.restBody}</Text>
            {workout.next ? <Text variant="bodyStrong">{t.nextWorkout(WEEKDAY_LABELS[workout.next.weekday], workout.next.dayName)}</Text> : null}
          </Card>
        ) : null}
        </Reveal>
        </View>

        {meals && progress ? (
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
          <Reveal first={first} index={2}>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="heading">{t.mealsTitle}</Text>
              <Text variant="small" tone="muted">{t.mealsProgress(progress.eatenCount, progress.total)}</Text>
            </View>
            <FillBar fraction={progress.fraction} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={en.plan.preview.kcal} value={n(progress.eaten.kcal)} countTo={Math.round(progress.eaten.kcal)} hint={target ? t.target(target) : `of ${n(meals.totals.kcal)} kcal`} />
              <StatTile label={en.plan.preview.protein} value={n(progress.eaten.proteinG)} countTo={Math.round(progress.eaten.proteinG)} unit="g" hint={data.targets ? `of ${data.targets[meals.dayType].proteinG} g` : undefined} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label={en.plan.preview.carbs} value={n(progress.eaten.carbsG)} countTo={Math.round(progress.eaten.carbsG)} unit="g" hint={data.targets ? `of ${data.targets[meals.dayType].carbsG} g` : undefined} />
              <StatTile label={en.plan.preview.fat} value={n(progress.eaten.fatG)} countTo={Math.round(progress.eaten.fatG)} unit="g" hint={data.targets ? `of ${data.targets[meals.dayType].fatG} g` : undefined} />
            </View>
            {meals.meals.map((m, i) => {
              const { options, all } = optionsFor(i);
              if (all.length > 0 && !seenSlots.has(i)) {
                seenSlots.add(i);
                trackEvent('meal_option_viewed', { placement: 'today', slot: mealKind(m.name), source });
              }
              return (
                <View key={`${m.name}-${i}`} style={{ gap: spacing.sm }}>
                  {/* The meal changes with a fade (instant with reduced motion) when another option is chosen. */}
                  <FadeSlideIn key={m.recipe}>
                    <ListItem
                      title={m.name}
                      subtitle={`${m.recipe} · ${m.kcal} kcal`}
                      onPress={() => toggle(i)}
                      trailing={<Text variant="small" tone={eaten.includes(i) ? 'accent' : 'muted'}>{eaten.includes(i) ? t.unmarkEaten : t.markEaten}</Text>}
                    />
                  </FadeSlideIn>
                  <MealOptions slotName={m.name} options={options} all={all} busy={swapping} onPick={(o) => void chooseOption(i, o)} />
                </View>
              );
            })}
          </Card>
          </Reveal>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

export default function TodayScreen() {
  return (
    <FocusFade>
      <PlanGate>{(data) => <Today data={data} />}</PlanGate>
    </FocusFade>
  );
}
