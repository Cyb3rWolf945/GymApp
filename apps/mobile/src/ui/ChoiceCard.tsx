import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { durationFor, easing, usePressSpring, useHaptics, useReducedMotion } from '../motion';
import { motion, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface CardProps {
  label: string;
  icon: IconName;
  selected?: boolean;
  onPress?: () => void;
}

/** A large, playful choice: an icon tile and a label. Same semantics as a Chip (a checkbox named by its label). */
export function ChoiceCard({ label, icon, selected = false, onPress }: CardProps) {
  const { colors, radius, spacing, elevation } = useTheme();
  const reduced = useReducedMotion();
  const haptic = useHaptics();
  const press = usePressSpring();
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (selected && !reduced) {
      Animated.sequence([
        Animated.timing(pop, { toValue: motion.popScale, duration: durationFor('fast', false) / 2, easing: easing('enter'), useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: durationFor('fast', false), easing: easing('standard'), useNativeDriver: true }),
      ]).start();
    }
  }, [selected, reduced, pop]);
  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          if (!selected) haptic();
          onPress?.();
        }}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: press.scale }],
              minHeight: 72,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.surface : colors.surfaceAlt,
            },
            selected ? elevation.low : null,
          ]}
        >
          <View style={{ width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient pointerEvents="none" colors={selected ? [...colors.gradient.brand] : [colors.surface, colors.surface]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Icon name={icon} size={26} color={selected ? colors.onAccent : colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{label}</Text>
          </View>
          {selected ? <Icon name="checkmark-circle" size={24} tone="accent" /> : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

interface GroupProps<T extends string> {
  options: readonly { value: T; label: string }[];
  icons: Record<T, IconName>;
  value: readonly T[];
  onChange: (next: T[]) => void;
}

/** Single choice, stacked cards. */
export function ChoiceCardGroup<T extends string>({ options, icons, value, onChange }: GroupProps<T>) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {options.map((o) => (
        <ChoiceCard key={o.value} label={o.label} icon={icons[o.value]} selected={value.includes(o.value)} onPress={() => onChange(value.includes(o.value) ? [] : [o.value])} />
      ))}
    </View>
  );
}
