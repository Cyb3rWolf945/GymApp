import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mealKind, scaleIngredients } from '@gymapp/shared';
import { en } from '../../../src/copy/en';
import { type RecipeDetail, fetchRecipeDetail } from '../../../src/plan/api';
import { useBreakpoint, useTheme } from '../../../src/theme';
import { Button, Card, EmptyState, FoodArt, ListItem, MacroKey, MacroRing, Screen, ScreenSkeleton, Text } from '../../../src/ui';

const r = en.nutrition.recipe;

export default function RecipeScreen() {
  const { slug, portions: portionsParam, meal } = useLocalSearchParams<{ slug: string; portions?: string; meal?: string }>();
  const portions = Math.min(4, Math.max(0.25, Number(portionsParam) || 1));
  const router = useRouter();
  const wide = useBreakpoint() === 'expanded';
  const { colors, radius, spacing } = useTheme();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; recipe: RecipeDetail | null }>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    fetchRecipeDetail(String(slug)).then(
      (recipe) => active && setState({ status: 'ready', recipe }),
      () => active && setState({ status: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [slug]);

  const body = () => {
    if (state.status === 'loading') return <ScreenSkeleton title={false} label={en.common.loading} />;
    if (state.status === 'error') return <EmptyState title={r.loadError} actionLabel={en.common.retry} onAction={() => router.replace({ pathname: '/recipe/[slug]', params: { slug: String(slug), portions: String(portions) } })} />;
    if (!state.recipe) return <EmptyState title={r.missing} />;
    const rec = state.recipe;
    const m = (v: number | null) => Math.round((v ?? 0) * portions);
    const steps = (rec.instructions ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    return (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <FoodArt kind={mealKind(meal ?? '')} size={96} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="display">{rec.name}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <MacroRing
            kcal={m(rec.kcal)}
            proteinG={m(rec.protein_g)}
            carbsG={m(rec.carbs_g)}
            fatG={m(rec.fat_g)}
            label={en.nutrition.ringLabel(m(rec.kcal), m(rec.protein_g), m(rec.carbs_g), m(rec.fat_g))}
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text tone="muted">{r.portions(portions)} · {en.nutrition.kcalMeal(m(rec.kcal))}</Text>
            <Text tone="muted">{r.macros(m(rec.protein_g), m(rec.carbs_g), m(rec.fat_g))}</Text>
            <MacroKey />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }} accessibilityLabel={r.allergens}>
          {rec.allergens.length === 0 ? <Text variant="small" tone="muted">{r.none}</Text> : null}
          {rec.allergens.map((a) => (
            <View key={a} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface }}>
              <Text variant="small">{r.allergenNames[a] ?? a}</Text>
            </View>
          ))}
        </View>
        {/* Ingredients and steps side by side on wide screens. */}
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.lg }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
        <Card style={{ gap: spacing.xs }}>
          <Text variant="heading">{r.ingredients}</Text>
          {scaleIngredients(rec.ingredients, rec.servings, portions).map((i) => (
            <ListItem key={i.name} title={i.name} trailing={<Text tone="muted">{i.scaledGrams} g</Text>} />
          ))}
        </Card>
        </View>
        {steps.length ? (
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{r.steps}</Text>
            {steps.map((s, i) => (
              <Text key={i}>{`${i + 1}. ${s.replace(/^\d+[.)]\s*/, '')}`}</Text>
            ))}
          </Card>
          </View>
        ) : null}
        </View>
      </>
    );
  };

  return (
    <Screen variant="dashboard" style={{ gap: spacing.lg }}>
      {body()}
      <Button label={en.common.close} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
