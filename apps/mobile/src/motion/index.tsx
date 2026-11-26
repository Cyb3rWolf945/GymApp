import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { type MotionEasing, motion } from '../theme/tokens';
import { type FeedbackEvent, type StepDirection, countUpValue, durationFor, hapticFor, pressScale, slideOffset } from './logic';
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

/**
 * Cross-fades a screen in each time it comes into focus (switching tabs). Works the same on the web and on phones, so
 * it does not rely on the navigator's own animation. Reduced motion: no fade, the screen is simply there.
 */
export function FocusFade({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useFocusEffect(
    useCallback(() => {
      if (reduced) {
        opacity.setValue(1);
        return;
      }
      opacity.setValue(0);
      const run = Animated.timing(opacity, { toValue: 1, duration: durationFor('base', false), easing: easing('enter'), useNativeDriver: true });
      run.start();
      return () => run.stop();
    }, [reduced, opacity]),
  );
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

/** A light tap on a phone when something is chosen. Never on the web, never with reduced motion. */
export function useHaptics() {
  const fire = useFeedback();
  return useCallback(() => fire('choice'), [fire]);
}

/**
 * The tap that goes with a moment (a choice, a set logged, a personal record, the plan being ready). A no-op on the
 * web and with reduced motion.
 */
export function useFeedback() {
  const reduced = useReducedMotion();
  return useCallback(
    (event: FeedbackEvent) => {
      const h = hapticFor(event, Platform.OS, reduced);
      if (!h) return;
      const run =
        h.kind === 'notification'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(h.weight === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      void run.catch(() => undefined);
    },
    [reduced],
  );
}

/**
 * A press state that springs: the thing shrinks a little while pressed and springs back (a quick settle, not a timed
 * ease). With reduced motion it does not move at all. Returns the animated scale and the two press handlers.
 */
export function usePressSpring(scaleTo: number = motion.pressScale) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = useCallback(
    (value: number) => {
      if (reduced) return;
      Animated.spring(scale, { toValue: value, stiffness: motion.spring.stiffness, damping: motion.spring.damping, mass: motion.spring.mass, useNativeDriver: true }).start();
    },
    [reduced, scale],
  );
  const onPressIn = useCallback(() => to(pressScale(reduced, scaleTo)), [to, reduced, scaleTo]);
  const onPressOut = useCallback(() => to(1), [to]);
  return { scale, onPressIn, onPressOut };
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
