import { ActivityIndicator, Pressable, type PressableProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  /** Verb-first, sentence case: "Start workout". */
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({ label, variant = 'primary', loading = false, disabled, ...rest }: Props) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const inactive = disabled || loading;
  const bg = { primary: colors.accent, secondary: colors.surfaceAlt, ghost: 'transparent', danger: colors.danger }[variant];
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.background : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, minHeight: Math.max(minTapTarget, 52), borderRadius: radius.md, paddingHorizontal: spacing.xl },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        { opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text variant="bodyStrong" style={{ color: fg }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center' } });
