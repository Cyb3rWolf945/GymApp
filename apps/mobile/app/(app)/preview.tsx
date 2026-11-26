import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { type PlanPreview, buildPreview, latestJobs } from '@gymapp/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { en } from '../../src/copy/en';
import { FadeSlideIn, staggerDelay, useReducedMotion } from '../../src/motion';
import { trackEvent } from '../../src/analytics/track';
import { fetchAccess, fetchCatalogNames, fetchJobs } from '../../src/plan/api';
import { useTheme } from '../../src/theme';
import { Button, Card, Celebration, EmptyState, ListItem, Screen, ScreenSkeleton, StatTile, Text } from '../../src/ui';

const t = en.plan.preview;

type State = { kind: 'loading' } | { kind: 'ready'; preview: PlanPreview } | { kind: 'error' };

/** Screen 15: first workout, first day of meals, kcal/macros and a short "why". */
export default function Preview() {
  const { user } = useAuth();
  const router = useRouter();
  const { spacing } = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [entitled, setEntitled] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const jobs = latestJobs(await fetchJobs(user.id));
        const w = jobs.workout_plan?.result as { plan?: { days?: { exercises?: { exerciseSlug: string }[] }[] } } | undefined;
        const n = jobs.nutrition_plan?.result as { plan?: { days?: { meals?: { recipeSlug: string }[] }[] } } | undefined;
        const exerciseSlugs = (w?.plan?.days?.[0]?.exercises ?? []).map((e) => e.exerciseSlug);
        const recipeSlugs = (n?.plan?.days?.[0]?.meals ?? []).map((m) => m.recipeSlug);
        const [{ exerciseNames, recipes }, isEntitled] = await Promise.all([fetchCatalogNames(exerciseSlugs, recipeSlugs), fetchAccess('basic')]);
        if (!active) return;
        const preview = buildPreview(jobs.workout_plan?.result, jobs.nutrition_plan?.result, exerciseNames, recipes);
        setEntitled(isEntitled);
        if (preview.workout && preview.meals) trackEvent('plan_preview_view', {});
        setState(preview.workout && preview.meals ? { kind: 'ready', preview } : { kind: 'error' });
      } catch {
        if (active) setState({ kind: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (state.kind === 'loading') {
    return <Screen><ScreenSkeleton label={en.common.loading} /></Screen>;
  }
  if (state.kind === 'error') {
    return (
      <Screen center>
        <EmptyState title={t.missing} actionLabel={en.plan.generating.retry} onAction={() => router.replace('/generating')} />
      </Screen>
    );
  }

  const { workout, meals, disclaimer } = state.preview;
  const n = (v: number) => String(Math.round(v));
  return (
    <Screen footer={<Button label={t.cta} onPress={() => router.replace(entitled ? '/' : '/paywall')} />}>
        <Celebration />
        <Text variant="display">{t.title}</Text>

        {/* The cards reveal one after another. */}
        <FadeSlideIn direction="up" delay={staggerDelay(1, reduced)}>
        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{t.workoutTitle}</Text>
          <Text tone="muted">{workout!.dayName}</Text>
          {workout!.exercises.map((e) => (
            <ListItem key={e.slug} title={e.name} subtitle={t.setsReps(e.sets, e.reps)} />
          ))}
          <Text variant="small" tone="muted">{t.why}: {workout!.rationale}</Text>
        </Card>
        </FadeSlideIn>

        <FadeSlideIn direction="up" delay={staggerDelay(3, reduced)}>
        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">{t.mealsTitle}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatTile label={t.kcal} value={n(meals!.totals.kcal)} />
            <StatTile label={t.protein} value={n(meals!.totals.proteinG)} unit="g" />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatTile label={t.carbs} value={n(meals!.totals.carbsG)} unit="g" />
            <StatTile label={t.fat} value={n(meals!.totals.fatG)} unit="g" />
          </View>
          {meals!.meals.map((m, i) => (
            <ListItem key={`${m.name}-${i}`} title={m.name} subtitle={`${m.recipe} · ${t.portions(m.portions)} · ${m.kcal} kcal`} />
          ))}
          <Text variant="small" tone="muted">{t.why}: {meals!.rationale}</Text>
        </Card>
        </FadeSlideIn>

        {disclaimer ? (
          <FadeSlideIn direction="up" delay={staggerDelay(5, reduced)}>
            <Card>
              <Text variant="small">{disclaimer}</Text>
            </Card>
          </FadeSlideIn>
        ) : null}
    </Screen>
  );
}
