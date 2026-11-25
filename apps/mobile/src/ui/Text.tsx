import { Text as RNText, type TextProps } from 'react-native';
import { type TypographyVariant, useTheme } from '../theme';

interface Props extends TextProps {
  variant?: TypographyVariant;
  tone?: 'default' | 'muted' | 'accent' | 'danger' | 'success';
}

export function Text({ variant = 'body', tone = 'default', style, ...rest }: Props) {
  const { colors, typography } = useTheme();
  const color = { default: colors.text, muted: colors.muted, accent: colors.accent, danger: colors.danger, success: colors.success }[tone];
  return <RNText {...rest} style={[typography[variant], { color }, style]} />;
}
