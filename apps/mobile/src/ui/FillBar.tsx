import { useEffect, useRef } from 'react';
import { Animated, View, type AccessibilityRole } from 'react-native';
import { durationFor, easing, useReducedMotion } from '../motion';
import { useTheme } from '../theme';

/** A thin progress bar (0 to 1) whose fill glides to its new value. Reduced motion: it jumps. */
export function FillBar({ fraction, height = 6, label }: { fraction: number; height?: number; label?: string }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const f = Math.min(1, Math.max(0, fraction));
  const shown = useRef(new Animated.Value(reduced ? f : 0)).current;
  useEffect(() => {
    if (reduced) {
      shown.setValue(f);
      return;
    }
    const run = Animated.timing(shown, { toValue: f, duration: durationFor('slow', false), easing: easing('standard'), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [f, reduced, shown]);
  const width = shown.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View accessibilityRole={'progressbar' as AccessibilityRole} accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }} style={{ height, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.accent }} />
    </View>
  );
}
