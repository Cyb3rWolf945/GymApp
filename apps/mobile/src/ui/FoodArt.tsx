import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type MealKind } from '@gymapp/shared';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

const ICONS: Record<MealKind, IconName> = {
  breakfast: 'cafe',
  lunch: 'restaurant',
  dinner: 'moon',
  snack: 'nutrition',
  other: 'restaurant',
};

/**
 * The picture of a meal until there are photos: a brand-gradient tile with the glyph of the kind of meal. Decoration,
 * hidden from screen readers (the meal's name is always next to it).
 */
export function FoodArt({ kind, size = 48 }: { kind: MealKind; size?: number }) {
  const { colors, radius } = useTheme();
  return (
    <View testID="food-art" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: size, height: size, borderRadius: size >= 96 ? radius.xl : radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient pointerEvents="none" colors={[...colors.gradient.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Icon name={ICONS[kind]} size={Math.round(size * 0.5)} color={colors.onAccent} />
    </View>
  );
}
