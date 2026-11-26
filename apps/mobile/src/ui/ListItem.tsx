import type { ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { usePressSpring } from '../motion';
import { motion, useTheme } from '../theme';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  /** Before the text: a picture or a check. */
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Makes the row a checkbox (a shopping list) instead of a plain button. */
  checked?: boolean;
}

export function ListItem({ title, subtitle, leading, trailing, onPress, checked }: Props) {
  const { colors, spacing, minTapTarget } = useTheme();
  // A row springs in a touch when pressed (less than a button); with reduced motion it only dims. The press target is a
  // plain Pressable (its style function only dims it); the layout and the scale live on an inner Animated.View, because
  // core Animated cannot resolve animated values inside a style function.
  const { scale, onPressIn, onPressOut } = usePressSpring(motion.rowPressScale);
  return (
    <Pressable
      accessibilityRole={onPress ? (checked === undefined ? 'button' : 'checkbox') : undefined}
      accessibilityState={checked === undefined ? undefined : { checked }}
      aria-checked={checked}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Animated.View
        style={{
          minHeight: Math.max(minTapTarget, 56),
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          transform: [{ scale }],
        }}
      >
        {leading}
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          {subtitle ? <Text variant="small" tone="muted">{subtitle}</Text> : null}
        </View>
        {trailing}
      </Animated.View>
    </Pressable>
  );
}
