import type { ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { usePressSpring } from '../motion';
import { motion, useTheme } from '../theme';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}

export function ListItem({ title, subtitle, trailing, onPress }: Props) {
  const { colors, spacing, minTapTarget } = useTheme();
  // A row springs in a touch when pressed (less than a button); with reduced motion it only dims. The press target is a
  // plain Pressable (its style function only dims it); the layout and the scale live on an inner Animated.View, because
  // core Animated cannot resolve animated values inside a style function.
  const { scale, onPressIn, onPressOut } = usePressSpring(motion.rowPressScale);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
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
          borderBottomColor: colors.border,
          transform: [{ scale }],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          {subtitle ? <Text variant="small" tone="muted">{subtitle}</Text> : null}
        </View>
        {trailing}
      </Animated.View>
    </Pressable>
  );
}
