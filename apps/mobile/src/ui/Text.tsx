import { Platform, Text as RNText, type TextProps } from 'react-native';
import { type TypographyVariant, useTheme } from '../theme';

interface Props extends TextProps {
  variant?: TypographyVariant;
  tone?: 'default' | 'muted' | 'accent' | 'accent2' | 'danger' | 'success';
}

export function Text({ variant = 'body', tone = 'default', style, ...rest }: Props) {
  const { colors, typography } = useTheme();
  const color = { default: colors.text, muted: colors.muted, accent: colors.accent, accent2: colors.accent2, danger: colors.danger, success: colors.success }[tone];
  const t = typography[variant];
  // On the web a font that has not loaded falls back to a system sans, not to the browser's serif default.
  const family = Platform.OS === 'web' ? { fontFamily: `${t.fontFamily}, system-ui, -apple-system, Segoe UI, Roboto, sans-serif` } : null;
  return <RNText {...rest} style={[t, family, { color }, style]} />;
}
