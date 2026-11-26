import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, type PressableProps, StyleSheet } from 'react-native';
import { easing, useReducedMotion } from '../motion';
import { motion, useTheme } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  /** Verb-first, sentence case: "Start workout". */
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, variant = 'primary', loading = false, disabled, onPressIn, onPressOut, ...rest }: Props) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current; // 0 = resting, 1 = pressed in
  const inactive = disabled || loading;
  const bg = { primary: colors.accent, secondary: colors.surfaceAlt, ghost: 'transparent', danger: colors.danger }[variant];
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.background : colors.text;
  const to = (value: number) => Animated.timing(press, { toValue: value, duration: motion.duration.fast / 2, easing: easing('standard'), useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={4}
      onPressIn={(e) => {
        to(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(0);
        onPressOut?.(e);
      }}
      style={[
        styles.base,
        { backgroundColor: bg, minHeight: Math.max(minTapTarget, 52), borderRadius: radius.md, paddingHorizontal: spacing.xl },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        // A soft halo in the brand colour under the main button (the palette leaves it empty where it would look dirty).
        variant === 'primary' && !inactive && colors.accentGlow !== '' && { boxShadow: `0 6px 20px ${colors.accentGlow}` },
        {
          // Pressed: shrink a little (not with reduced motion) and dim a little.
          opacity: Animated.multiply(press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }), inactive ? 0.5 : 1),
          transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : motion.pressScale] }) }],
        },
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text variant="bodyStrong" style={{ color: fg, textAlign: 'center' }}>{label}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center' } });
