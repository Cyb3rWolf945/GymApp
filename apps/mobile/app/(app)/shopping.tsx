import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { NutritionPlanSchema, WorkoutPlanSchema, activeChecked, buildShoppingList, trainingWeekdays, type ShoppingRecipe } from '@gymapp/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { en } from '../../src/copy/en';
import { PlanGate } from '../../src/home/PlanGate';
import { type PlanData, PlanDataProvider } from '../../src/home/usePlanData';
import { clearCheckedItems, fetchCheckedItems, fetchShoppingRecipes, setItemChecked } from '../../src/plan/api';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, Icon, type IconName, ListItem, ProgressBar, ResponsiveGrid, Screen, ScreenSkeleton, Text } from '../../src/ui';

const t = en.nutrition.shopping;

/** One glyph per aisle, so the list reads at a glance. */
const CATEGORY_ICONS: Record<string, IconName> = {
  produce: 'leaf',
  meat: 'restaurant',
  fish_seafood: 'fish',
  dairy: 'water',
  eggs: 'egg',
  grains: 'nutrition',
  legumes: 'ellipse',
  plant_protein: 'leaf',
  nuts_seeds: 'ellipse',
  fats_oils: 'water',
  condiments: 'flask',
  spices: 'flame',
};

function Shopping({ data }: { data: PlanData }) {
  const { spacing } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Map<string, ShoppingRecipe> | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => {
    const p = NutritionPlanSchema.safeParse((data.nutritionResult as { plan?: unknown } | null)?.plan);
    return p.success ? p.data : null;
  }, [data]);
  const weekdays = useMemo(() => {
    const w = WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan);
    const training = w.success ? trainingWeekdays(w.data.days.length, data.preferredDays).length : 0;
    return { training, rest: 7 - training };
  }, [data]);

  // The list is derived from the current plan, so it follows plan changes and meal swaps (the data reloads after a swap).
  const load = useCallback(async () => {
    setError(null);
    setRecipes(null);
    try {
      const slugs = [...new Set(plan?.days.flatMap((d) => d.meals.map((m) => m.recipeSlug)) ?? [])];
      const [r, c] = await Promise.all([fetchShoppingRecipes(slugs), fetchCheckedItems(data.nutritionJobId)]);
      setRecipes(r);
      setChecked(new Set(c));
    } catch {
      setError(t.loadError);
    }
  }, [plan, data.nutritionJobId]);
  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => (plan && recipes ? buildShoppingList(plan, weekdays, recipes) : []), [plan, recipes, weekdays]);
  const done = useMemo(() => activeChecked(groups, checked), [groups, checked]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  const toggle = async (label: string, grams: number) => {
    if (!user) return;
    const next = !done.has(label);
    setChecked((prev) => new Set(next ? [...prev, label] : [...prev].filter((l) => l !== label)));
    if (!(await setItemChecked(user.id, data.nutritionJobId, label, grams, next))) {
      setChecked((prev) => new Set(next ? [...prev].filter((l) => l !== label) : [...prev, label]));
      setError(t.saveError);
    }
  };
  const clear = async () => {
    const before = checked;
    setChecked(new Set());
    if (!(await clearCheckedItems(data.nutritionJobId))) {
      setChecked(before);
      setError(t.saveError);
    }
  };

  return (
    <Screen variant="dashboard">
        <Text variant="display">{t.title}</Text>
        <Text tone="muted">{t.body}</Text>
        {error && !recipes ? <EmptyState title={error} actionLabel={en.common.retry} onAction={() => void load()} /> : null}
        {error && recipes ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        {!recipes && !error ? <ScreenSkeleton title={false} cards={3} label={en.common.loading} /> : null}
        {recipes && total === 0 ? <EmptyState title={t.empty} actionLabel={en.home.tabs.nutrition} onAction={() => router.replace('/nutrition')} /> : null}
        {total > 0 ? <ProgressBar step={done.size} total={total} label={t.checkedCount(done.size, total)} /> : null}
        <ResponsiveGrid gap={spacing.lg}>
        {groups.map((g) => (
          <Card key={g.category} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name={CATEGORY_ICONS[g.category] ?? 'basket'} size={22} tone="accent" />
              <Text variant="heading">{t.categories[g.category] ?? g.category}</Text>
            </View>
            {g.items.map((i) => (
              <ListItem
                key={i.label}
                title={i.label}
                checked={done.has(i.label)}
                leading={<Icon name={done.has(i.label) ? 'checkmark-circle' : 'ellipse-outline'} size={26} tone={done.has(i.label) ? 'accent' : 'muted'} />}
                onPress={() => void toggle(i.label, i.grams)}
                trailing={<Text tone="muted">{i.quantity}</Text>}
              />
            ))}
          </Card>
        ))}
        </ResponsiveGrid>
        {done.size > 0 ? <Button label={t.clear} variant="secondary" onPress={() => void clear()} /> : null}
        <Button label={en.common.close} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

/** Outside the tabs, so it brings its own plan data: without a provider `usePlanData` stays on "loading" forever. */
export default function ShoppingScreen() {
  return (
    <PlanDataProvider>
      <PlanGate>{(data) => <Shopping data={data} />}</PlanGate>
    </PlanDataProvider>
  );
}
