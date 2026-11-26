import { View } from 'react-native';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Text } from './Text';

/** What the colours of the macro ring mean: three dots with their names. Matches the ring's order and colours. */
export function MacroKey() {
  const { colors, spacing } = useTheme();
  const items = [
    { label: en.plan.preview.protein, color: colors.chart[0] },
    { label: en.plan.preview.carbs, color: colors.accent2 },
    { label: en.plan.preview.fat, color: colors.success },
  ];
  return (
    <View testID="macro-key" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i.color }} />
          <Text variant="small" tone="muted">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}
