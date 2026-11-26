import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { type MealOption } from '@gymapp/shared';
import { en } from '../copy/en';
import { useBreakpoint, useTheme } from '../theme';
import { BottomSheet, Button, Text, TextField } from '../ui';

const t = en.home;

/** One alternative as a compact card: name, kcal, protein, prep time. */
function OptionCard({ option, onPick, disabled, fill }: { option: MealOption; onPick: () => void; disabled?: boolean; fill?: boolean }) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const r = option.recipe;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.useOption(r.name)}. ${t.optionLine(option.kcal, option.proteinG, r.prep_minutes)}`}
      disabled={disabled}
      onPress={onPick}
      style={{ minHeight: minTapTarget, ...(fill ? { flex: 1, minWidth: 0 } : { width: 168 }), gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, opacity: disabled ? 0.5 : 1 }}
    >
      <Text variant="bodyStrong" numberOfLines={2}>{r.name}</Text>
      <Text variant="caption" tone="muted">{t.optionLine(option.kcal, option.proteinG, r.prep_minutes)}</Text>
    </Pressable>
  );
}

/**
 * "Other options" under a meal: 2 or 3 alternatives (a row you scroll on phones, wrapping inline on wider screens) and
 * "See more", which opens a sheet with up to 8 and a search box. Choosing one calls `onPick`.
 */
export function MealOptions({ slotName, options, all, onPick, busy }: { slotName: string; options: MealOption[]; all: MealOption[]; onPick: (o: MealOption) => void; busy?: boolean }) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  if (all.length === 0) return null;
  const shown = all.filter((o) => o.recipe.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="small" tone="muted">{t.otherOptions}</Text>
      {wide ? (
        // Equal columns across the row, so three cards fill it and none wraps alone.
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {options.map((o) => <OptionCard key={o.recipe.slug} option={o} fill disabled={busy} onPick={() => onPick(o)} />)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {options.map((o) => <OptionCard key={o.recipe.slug} option={o} disabled={busy} onPick={() => onPick(o)} />)}
        </ScrollView>
      )}
      {all.length > 0 ? <Button label={t.seeMore} variant="ghost" onPress={() => setOpen(true)} /> : null}
      <BottomSheet visible={open} onClose={() => { setOpen(false); setQuery(''); }} title={t.optionsFor(slotName)} closeLabel={en.common.close}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t.searchRecipes}
          accessibilityLabel={t.searchRecipes}
          style={{ minHeight: 48 }}
        />
        {shown.length === 0 ? <Text tone="muted">{t.noOptionsFound}</Text> : null}
        {shown.map((o) => (
          <Pressable
            key={o.recipe.slug}
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              setQuery('');
              onPick(o);
            }}
            style={{ minHeight: minTapTarget, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
          >
            <Text variant="bodyStrong">{t.useOption(o.recipe.name)}</Text>
            <Text variant="caption" tone="muted">{t.optionLine(o.kcal, o.proteinG, o.recipe.prep_minutes)}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}
