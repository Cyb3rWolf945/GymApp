import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import {
  NutritionPlanSchema, mealKind, type RecipeCandidate, WEEKDAYS, WEEKDAY_LABELS, WorkoutPlanSchema, mealSwapCandidates, nutritionDayTotals, trainingWeekdays, usedStarterPlan } from '@gymapp/shared';
import { useAuth } from '../../../src/auth/AuthProvider';
import { FocusFade } from '../../../src/motion';
import { en } from '../../../src/copy/en';
import { PlanGate } from '../../../src/home/PlanGate';
import { type PlanData, usePlanData } from '../../../src/home/usePlanData';
import { fetchAccess, fetchRecipeLibrary, recordMealSwap } from '../../../src/plan/api';
import { StarterPlanNote } from '../../../src/plan/StarterPlanNote';
import { useTheme } from '../../../src/theme';
import { BottomSheet, Button, Card, EmptyState, FoodArt, InlineSkeleton, ListItem, MacroKey, MacroRing, ResponsiveGrid, Screen, ScreenSkeleton, Text, useToast } from '../../../src/ui';

const t = en.home;
const n = en.nutrition;

interface Target {
  dayIndex: number;
  mealIndex: number;
  slug: string;
  name: string;
  portions: number;
}

function Nutrition({ data }: { data: PlanData }) {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const { reload } = usePlanData();
  const router = useRouter();
  const toast = useToast();
  const bySlug = useMemo(() => new Map(data.recipes.map((r) => [r.slug, r])), [data]);
  const plan = useMemo(() => {
    const p = NutritionPlanSchema.safeParse((data.nutritionResult as { plan?: unknown } | null)?.plan);
    return p.success ? p.data : null;
  }, [data]);
  const workoutDays = useMemo(() => {
    const p = WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan);
    return p.success ? p.data.days.length : 0;
  }, [data]);

  // The server decides (`my_access`); the database also refuses Pro-only writes without it.
  const [entitled, setEntitled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    void fetchAccess('nutrition').then(setEntitled, () => setEntitled(false));
  }, [user]);

  const [target, setTarget] = useState<Target | null>(null);
  const [options, setOptions] = useState<RecipeCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (entitled === null) {
    return <Screen variant="dashboard"><ScreenSkeleton label={en.common.loading} /></Screen>;
  }
  if (!entitled) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <EmptyState kind="locked" title={n.lockedTitle} body={n.lockedBody} actionLabel={n.lockedCta} onAction={() => router.push('/paywall')} />
      </SafeAreaView>
    );
  }

  // One card per weekday. Training weekdays use the "training" day of the plan, the rest use "rest".
  const trainOn = new Set(trainingWeekdays(workoutDays, data.preferredDays));
  const dayFor = (weekday: (typeof WEEKDAYS)[number]) => {
    const type = trainOn.has(weekday) ? 'training' : 'rest';
    const i = plan?.days.findIndex((d) => d.dayType === type) ?? -1;
    return i >= 0 ? i : 0;
  };

  const openSwap = async (tg: Target) => {
    setTarget(tg);
    setOptions(null);
    setError(null);
    try {
      const library = await fetchRecipeLibrary();
      const inDay = plan?.days[tg.dayIndex].meals.map((m) => m.recipeSlug) ?? [];
      setOptions(mealSwapCandidates({ slug: tg.slug, kcal: bySlug.get(tg.slug)?.kcal ?? null }, tg.portions, library, data.mealProfile, inDay));
    } catch {
      setError(n.swapLoadError);
    }
  };
  const choose = async (o: RecipeCandidate) => {
    if (!user || !target) return;
    setSaving(true);
    const ok = await recordMealSwap(user.id, data.nutritionJobId, target.dayIndex, target.mealIndex, target.slug, o.slug);
    setSaving(false);
    if (!ok) return setError(n.swapSaveError);
    setTarget(null);
    toast.show(n.swapDone(o.name), 'success');
    reload();
  };

  return (
    <Screen variant="dashboard">
        <Text variant="display">{t.nutritionTitle}</Text>
        {plan && usedStarterPlan(data.nutritionResult) ? <StarterPlanNote /> : null}
        {plan ? <Text tone="muted">{n.swapNote}</Text> : null}
        {plan ? <Button label={n.shoppingList} variant="secondary" onPress={() => router.push('/shopping')} /> : null}
        {plan ? (
          <ResponsiveGrid gap={spacing.xl}>
            {WEEKDAYS.map((weekday) => {
              const di = dayFor(weekday);
              const d = plan.days[di];
              const totals = nutritionDayTotals(d, bySlug);
              const targets = data.targets?.[d.dayType];
              return (
                <Card key={weekday} style={{ gap: spacing.sm }}>
                  <Text variant="small" tone="muted">{WEEKDAY_LABELS[weekday]} · {t.dayType[d.dayType]}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                    <MacroRing
                      kcal={totals.kcal}
                      proteinG={totals.proteinG}
                      carbsG={totals.carbsG}
                      fatG={totals.fatG}
                      label={n.ringLabel(Math.round(totals.kcal), Math.round(totals.proteinG), Math.round(totals.carbsG), Math.round(totals.fatG))}
                    />
                    <View style={{ flex: 1 }}>
                      <Text tone="muted">
                        {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG)} g protein · {Math.round(totals.carbsG)} g carbs · {Math.round(totals.fatG)} g fat
                        {targets ? ` (${t.target(targets.kcal)})` : ''}
                      </Text>
                      <MacroKey />
                    </View>
                  </View>
                  {d.meals.map((m, j) => {
                    const r = bySlug.get(m.recipeSlug);
                    return (
                      <ListItem
                        key={`${m.name}-${j}`}
                        leading={<FoodArt kind={mealKind(m.name)} />}
                        title={m.name}
                        subtitle={`${r?.name ?? m.recipeSlug} · ${n.kcalMeal(Math.round((r?.kcal ?? 0) * m.portions))}`}
                        onPress={() => router.push({ pathname: '/recipe/[slug]', params: { slug: m.recipeSlug, portions: String(m.portions), meal: m.name } })}
                        trailing={
                          <Text
                            variant="small"
                            tone="accent"
                            accessibilityRole="button"
                            onPress={() => void openSwap({ dayIndex: di, mealIndex: j, slug: m.recipeSlug, name: r?.name ?? m.recipeSlug, portions: m.portions })}
                          >
                            {n.swapMeal}
                          </Text>
                        }
                      />
                    );
                  })}
                </Card>
              );
            })}
          </ResponsiveGrid>
        ) : null}
        {plan ? <Text tone="muted">{plan.rationale}</Text> : null}
      <BottomSheet visible={!!target} onClose={() => setTarget(null)} title={target ? n.swapTitle(target.name) : undefined} closeLabel={en.common.close}>
        <Text tone="muted">{n.swapBody}</Text>
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        {!options && !error ? <InlineSkeleton lines={3} label={en.common.loading} /> : null}
        {options && options.length === 0 ? <Text>{n.swapNone}</Text> : null}
        {options?.map((o) => (
          <Button key={o.slug} label={n.swapPick(o.name)} variant="secondary" loading={saving} onPress={() => void choose(o)} />
        ))}
      </BottomSheet>
    </Screen>
  );
}

export default function NutritionScreen() {
  return (
    <FocusFade>
      <PlanGate>{(data) => <Nutrition data={data} />}</PlanGate>
    </FocusFade>
  );
}
