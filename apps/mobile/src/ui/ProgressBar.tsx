import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { durationFor, easing, useReducedMotion } from '../motion';
import { useTheme } from '../theme';
import { progressFraction } from './logic';
import { Text } from './Text';

/** Onboarding progress. `step` is 1-based. */
export function ProgressBar({ step, total, label }: { step: number; total: number; label?: string }) {
  const { colors, spacing } = useTheme();
  const f = progressFraction(step, total);
  // The bar glides to its new value instead of jumping (width can't use the native driver).
  const reduced = useReducedMotion();
  const shown = useRef(new Animated.Value(f)).current;
  useEffect(() => {
    if (reduced) shown.setValue(f);
    else Animated.timing(shown, { toValue: f, duration: durationFor('base', false), easing: easing('standard'), useNativeDriver: false }).start();
  }, [f, reduced, shown]);
  const width = shown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progress'}
      accessibilityValue={{ min: 0, max: total, now: Math.min(step, total) }}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(step, total)}
    >
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <Animated.View style={{ width, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.accent }}>
          <LinearGradient colors={[...colors.gradient.brand]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      {label ? <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>{label}</Text> : null}
    </View>
  );
}
