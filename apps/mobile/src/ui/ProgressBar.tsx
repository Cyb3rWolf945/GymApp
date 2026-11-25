import { View } from 'react-native';
import { useTheme } from '../theme';
import { progressFraction } from './logic';
import { Text } from './Text';

/** Onboarding progress. `step` is 1-based. */
export function ProgressBar({ step, total, label }: { step: number; total: number; label?: string }) {
  const { colors, spacing } = useTheme();
  const f = progressFraction(step, total);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progress'}
      accessibilityValue={{ min: 0, max: total, now: Math.min(step, total) }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt }}>
        <View style={{ width: `${f * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
      </View>
      {label ? <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>{label}</Text> : null}
    </View>
  );
}
