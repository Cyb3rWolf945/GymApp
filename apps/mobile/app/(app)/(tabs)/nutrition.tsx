import { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NutritionPlanSchema, nutritionDayTotals } from '@gymapp/shared';
import { en } from '../../../src/copy/en';
import { PlanGate } from '../../../src/home/PlanGate';
import type { PlanData } from '../../../src/home/usePlanData';
import { useTheme } from '../../../src/theme';
import { Card, ListItem, Text } from '../../../src/ui';

const t = en.home;

function Nutrition({ data }: { data: PlanData }) {
  const { colors, spacing } = useTheme();
  const bySlug = useMemo(() => new Map(data.recipes.map((r) => [r.slug, r])), [data]);
  const parsed = useMemo(() => NutritionPlanSchema.safeParse((data.nutritionResult as { plan?: unknown } | null)?.plan), [data]);
  const plan = parsed.success ? parsed.data : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Text variant="display">{t.nutritionTitle}</Text>
        {plan?.days.map((d, i) => {
          const totals = nutritionDayTotals(d, bySlug);
          const target = data.targets?.[d.dayType];
          return (
            <Card key={`${d.dayType}-${i}`} style={{ gap: spacing.sm }}>
              <Text variant="heading">{t.dayType[d.dayType]}</Text>
              <Text tone="muted">
                {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG)} g protein · {Math.round(totals.carbsG)} g carbs · {Math.round(totals.fatG)} g fat
                {target ? ` (${t.target(target.kcal)})` : ''}
              </Text>
              {d.meals.map((m, j) => {
                const r = bySlug.get(m.recipeSlug);
                return <ListItem key={`${m.name}-${j}`} title={m.name} subtitle={`${r?.name ?? m.recipeSlug} · ${Math.round((r?.kcal ?? 0) * m.portions)} kcal`} />;
              })}
            </Card>
          );
        })}
        {plan ? <Text tone="muted">{plan.rationale}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function NutritionScreen() {
  return <PlanGate>{(data) => <Nutrition data={data} />}</PlanGate>;
}
