import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, View } from 'react-native';
import { useReducedMotion } from '../motion';
import { useTheme } from '../theme';
import { Card } from './Card';

/** One grey block that stands where a line, a title or a chart will be. It pulses; with reduced motion it just sits there. */
export function Skeleton({ width = '100%', height = 16, radius }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { colors, radius: r } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(reduced ? 0.6 : 0.4)).current;
  useEffect(() => {
    if (reduced) {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);
  return <Animated.View style={{ width, height, borderRadius: radius ?? r.sm, backgroundColor: colors.surfaceAlt, opacity: pulse }} />;
}

/**
 * What a data screen shows while it loads: a title and a few cards of lines, in the shape of the real content. Screen
 * readers hear "Loading" once; the blocks themselves are hidden from them.
 */
export function ScreenSkeleton({ cards = 2, label = 'Loading…', title = true }: { cards?: number; label?: string; title?: boolean }) {
  const { spacing } = useTheme();
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" accessibilityLiveRegion="polite" aria-busy style={{ gap: spacing.xl }}>
      {title ? <Skeleton width="45%" height={32} /> : null}
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} style={{ gap: spacing.md }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Skeleton width="35%" height={20} />
          <Skeleton height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={14} />
        </Card>
      ))}
    </View>
  );
}

/** A few lines in place of a small spinner: inside a sheet, a card or under a heading. Announced as "Loading" once. */
export function InlineSkeleton({ lines = 3, label = 'Loading…' }: { lines?: number; label?: string }) {
  const { spacing } = useTheme();
  const widths = ['100%', '85%', '65%', '90%'] as const;
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" accessibilityLiveRegion="polite" aria-busy style={{ gap: spacing.sm }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={16} />
      ))}
    </View>
  );
}
