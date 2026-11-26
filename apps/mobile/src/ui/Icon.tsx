import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';

/** The icon set: Ionicons, outline when idle and filled when active, one stroke weight everywhere. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  name: IconName;
  size?: number;
  /** A palette colour name; defaults to the text colour. */
  tone?: 'text' | 'muted' | 'accent' | 'accent2' | 'danger' | 'success';
  /** Pass a literal colour (tab bars hand over their own tint). */
  color?: string;
}

/** Decorative by default: the label next to it names the thing, so screen readers skip the glyph. */
export function Icon({ name, size = 24, tone = 'text', color }: Props) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? (tone === 'accent' ? colors.accentText : colors[tone])} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden />;
}
