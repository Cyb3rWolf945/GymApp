import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { durationFor, easing, useHaptics, useReducedMotion } from '../motion';
import { motion, useTheme } from '../theme';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected = false, onPress, disabled }: ChipProps) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const reduced = useReducedMotion();
  const haptic = useHaptics();
  // Colour and border fade between states (JS driven: colours can't use the native driver); the scale "pop" and the
  // check run on the native side. They sit on separate nodes because one node can't mix the two.
  const tint = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (reduced) tint.setValue(selected ? 1 : 0);
    else Animated.timing(tint, { toValue: selected ? 1 : 0, duration: durationFor('fast', false), easing: easing('standard'), useNativeDriver: false }).start();
    if (first.current) {
      first.current = false;
      return;
    }
    if (selected && !reduced) {
      Animated.sequence([
        Animated.timing(pop, { toValue: motion.popScale, duration: motion.duration.fast / 2, easing: easing('enter'), useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: motion.duration.fast, easing: easing('standard'), useNativeDriver: true }),
      ]).start();
    }
  }, [selected, reduced, tint, pop]);
  const backgroundColor = tint.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceAlt, colors.accent] });
  const borderColor = tint.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accentBorder] });
  return (
    <Animated.View style={{ transform: [{ scale: pop }], opacity: disabled ? 0.5 : 1 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled }}
        aria-checked={selected}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => {
          if (!selected) haptic(); // choosing, not un-choosing
          onPress?.();
        }}
      >
        <Animated.View
          style={{
            minHeight: minTapTarget,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            backgroundColor,
            borderWidth: 1,
            borderColor,
          }}
        >
          {selected ? <CheckPop color={colors.onAccent} /> : null}
          <Text variant="bodyStrong" style={{ color: selected ? colors.onAccent : colors.text }}>{label}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** The small tick on a chosen chip: it pops in. Decorative (the checkbox state already says "checked"). */
function CheckPop({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.4)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 1, duration: motion.duration.fast, easing: easing('enter'), useNativeDriver: true }).start();
  }, [reduced, scale]);
  return (
    <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={{ transform: [{ scale }] }}>
      <Text variant="bodyStrong" style={{ color }}>✓</Text>
    </Animated.View>
  );
}

interface GroupProps<T extends string> {
  options: readonly { value: T; label: string }[];
  /** Selected values. Single mode keeps at most one. */
  value: readonly T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
}

export function ChipGroup<T extends string>({ options, value, onChange, multiple = false }: GroupProps<T>) {
  const { spacing } = useTheme();
  const toggle = (v: T) => {
    const on = value.includes(v);
    if (multiple) onChange(on ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(on ? [] : [v]);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </View>
  );
}
