import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from '../motion';
import { useTheme } from '../theme';

const RINGS = [0, 1, 2] as const;

/** A pulsing orb with rings that spread out, above the steps while the plan is built. Decoration: hidden from screen readers, still with reduced motion. */
export function BuildingOrb() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, t]);
  return (
    <View testID="building-orb" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
      {RINGS.map((i) => {
        const phase = i / RINGS.length;
        const p = Animated.modulo(Animated.add(t, phase), 1);
        const scale = reduced ? 1 + phase : p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] });
        const opacity = reduced ? 0.2 : p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
        return (
          <Animated.View key={i} style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: colors.accent, opacity, transform: [{ scale }] }} />
        );
      })}
      <View style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden' }}>
        <LinearGradient colors={[...colors.gradient.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
