import { type ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type WorkoutFocus, workoutFocus } from '@gymapp/shared';
import { useTheme } from '../theme';
import { Icon, type IconName, Text } from '../ui';

/** The art of each kind of day: a big glyph, drawn large and faint behind the card, and small on the tile. */
const ART: Record<WorkoutFocus, IconName> = {
  push: 'barbell',
  pull: 'fitness',
  legs: 'walk',
  upper: 'body',
  lower: 'walk',
  full: 'flame',
  core: 'sync',
  other: 'barbell',
};

interface Props {
  dayName: string;
  meta: string;
  children: ReactNode;
}

/** Today's workout as the hero of the screen: a gradient card with the day's art, its name and the facts, then the content. */
export function WorkoutHero({ dayName, meta, children }: Props) {
  const { colors, radius, spacing, elevation } = useTheme();
  const icon = ART[workoutFocus(dayName)];
  return (
    <View testID="workout-hero" style={[{ borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, elevation.mid]}>
      <LinearGradient pointerEvents="none" colors={[...colors.gradient.glow]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }} />
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: 'absolute', top: 28, right: -36, opacity: 0.07 }}>
        <Icon name={icon} size={150} tone="accent" />
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient pointerEvents="none" colors={[...colors.gradient.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Icon name={icon} size={30} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{dayName}</Text>
            <Text tone="muted">{meta}</Text>
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}
