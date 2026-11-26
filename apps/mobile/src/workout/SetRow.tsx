import { View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from '../ui';

/**
 * One logged set as a big row: a round badge with the set number (or "W" for a warm-up), the weight and reps in large
 * type, the exercise and the effort next to it. Visual only: logging and undo work as before.
 */
export function SetRow({ badge, exercise, main, effort, warmup }: { badge: string; exercise: string; main: string; effort?: string; warmup?: boolean }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${exercise}: ${main}${effort ? `, ${effort}` : ''}`}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}
    >
      <View style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: warmup ? colors.surfaceAlt : colors.accent }}>
        <Text variant="bodyStrong" style={{ color: warmup ? colors.muted : colors.onAccent }}>{badge}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="heading">{main}</Text>
        <Text variant="small" tone="muted">{exercise}</Text>
      </View>
      {effort ? <Text variant="small" tone="accent">{effort}</Text> : null}
    </View>
  );
}
