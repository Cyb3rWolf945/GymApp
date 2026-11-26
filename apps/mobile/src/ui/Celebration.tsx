import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '../motion';
import { useTheme } from '../theme';

const PIECES = 18;

/**
 * A short burst of confetti, once, when something good lands (the plan is ready). Decoration: it never catches taps and
 * screen readers skip it. With reduced motion it is not drawn at all.
 */
export function Celebration() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * Math.PI * 2;
        const reach = 90 + (i % 4) * 28;
        return { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach - 40, size: 8 + (i % 3) * 3, round: i % 2 === 0, color: [colors.chart[0], colors.accent2, colors.success][i % 3] };
      }),
    [colors.chart[0], colors.accent2, colors.success],
  );
  useEffect(() => {
    if (reduced) return;
    const run = Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, t]);
  if (reduced) return null;
  return (
    <View testID="celebration" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ height: 0, alignItems: 'center', overflow: 'visible', zIndex: 1 }}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            width: p.size,
            height: p.size,
            borderRadius: p.round ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.dy, p.dy + 90] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 240}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
