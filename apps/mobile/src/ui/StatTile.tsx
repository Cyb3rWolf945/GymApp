import { View } from 'react-native';
import { useCountUp } from '../motion';
import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * One number with a label: "82.4 kg · Weight". With `countTo` the number counts up to it when it appears and whenever it
 * changes (reduced motion: shows it at once); `value` is the final text, which is also what screen readers read.
 */
export function StatTile({ label, value, unit, hint, countTo, compact = false, minWidth }: { label: string; value: string; unit?: string; hint?: string; countTo?: number; /** Smaller number and padding, for three tiles in a row on a phone. */ compact?: boolean; /** The narrowest the tile gets: in a wrapping row, a tile that would be narrower goes to the next row. */ minWidth?: number }) {
  const { colors, radius, spacing } = useTheme();
  const counted = useCountUp(countTo ?? 0);
  const shown = countTo === undefined ? value : String(counted);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={{ flex: 1, ...(minWidth ? { minWidth } : {}), backgroundColor: colors.surface, borderRadius: radius.md, padding: compact ? spacing.md : spacing.lg, borderWidth: 1, borderColor: colors.divider }}
    >
      <Text variant="caption" tone="muted">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        {/* A word ("Recovering") in a compact tile is set smaller than a number, so it fits a phone-width tile. */}
        <Text variant={compact ? (countTo === undefined ? 'bodyStrong' : 'heading') : 'title'}>{shown}</Text>
        {unit ? <Text variant="small" tone="muted">{unit}</Text> : null}
      </View>
      {hint ? <Text variant="caption" tone="accent">{hint}</Text> : null}
    </View>
  );
}
