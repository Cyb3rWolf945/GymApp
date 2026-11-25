import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { type MotionEasing, motion } from '../theme/tokens';
import { type StepDirection, countUpValue, durationFor, hapticsAllowed, slideOffset } from './logic';
import { useReducedMotion } from './useReducedMotion';

export { useReducedMotion } from './useReducedMotion';
export * from './logic';

/** A motion token easing as an Animated easing function. */
export const easing = (name: MotionEasing) => {
  const [a, b, c, d] = motion.easing[name];
  return Easing.bezier(a, b, c, d);
};

interface FadeSlideInProps {
  children: ReactNode;
  /** `forward` / `back`: slide in from the right / left (a step). `up`: rise a little (a card). `none`: only fade. */
  direction?: StepDirection | 'up';
  /** Wait before starting (ms), for staggered entrances. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades (and slides) its children in once, when it appears. Reduced motion: no animation, it is simply there. */
export function FadeSlideIn({ children, direction = 'none', delay = 0, style }: FadeSlideInProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: durationFor('base', false),
      delay,
      easing: easing('enter'),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
    // Once, when it appears.
  }, []);
  const horizontal = direction === 'up' ? 0 : slideOffset(direction, reduced);
  const vertical = direction === 'up' && !reduced ? 16 : 0;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [horizontal, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [vertical, 0] });
  return <Animated.View style={[{ opacity: progress, transform: [{ translateX }, { translateY }] }, style]}>{children}</Animated.View>;
}

/** A gentle left-right shake for "not yet". Reduced motion: nothing moves (the caller still shows the message). */
export function useShake() {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const run = useCallback(() => {
    if (reduced) return;
    const d = 50;
    Animated.sequence([-8, 8, -5, 5, 0].map((to) => Animated.timing(x, { toValue: to, duration: d, easing: Easing.linear, useNativeDriver: true }))).start();
  }, [reduced, x]);
  return { style: { transform: [{ translateX: x }] }, run };
}

/** A short pulse that confirms a choice, then calls `then`. Reduced motion: calls `then` straight away. */
export function useConfirmPulse() {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const run = useCallback(
    (then: () => void) => {
      if (reduced) return then();
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.02, duration: 60, easing: easing('standard'), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 60, easing: easing('standard'), useNativeDriver: true }),
      ]).start(() => then());
    },
    [reduced, scale],
  );
  return { style: { transform: [{ scale }] }, run };
}

/** A light tap on a phone when something is chosen. Never on the web, never with reduced motion. */
export function useHaptics() {
  const reduced = useReducedMotion();
  return useCallback(() => {
    if (hapticsAllowed(Platform.OS, reduced)) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, [reduced]);
}

/** A number that counts up to `to` when it appears (about 0.7 s). Reduced motion: shows the final number at once. */
export function useCountUp(to: number): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return setValue(to);
    const progress = new Animated.Value(0);
    const id = progress.addListener(({ value: p }) => setValue(countUpValue(to, p)));
    const run = Animated.timing(progress, { toValue: 1, duration: motion.duration.slow * 1.75, easing: Easing.linear, useNativeDriver: false });
    run.start(({ finished }) => finished && setValue(to));
    return () => {
      run.stop();
      progress.removeListener(id);
    };
  }, [to, reduced]);
  return value;
}
