import { View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

/** One number with a label: "82.4 kg · Weight". */
export function StatTile({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}
    >
      <Text variant="caption" tone="muted">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        <Text variant="title">{value}</Text>
        {unit ? <Text variant="small" tone="muted">{unit}</Text> : null}
      </View>
      {hint ? <Text variant="caption" tone="accent">{hint}</Text> : null}
    </View>
  );
}
