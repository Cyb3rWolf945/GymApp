import { TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';

export function TextField({ style, ...rest }: TextInputProps) {
  const { colors, radius, spacing, minTapTarget, typography } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...rest}
      style={[
        typography.body,
        {
          minHeight: Math.max(minTapTarget, 96),
          color: colors.text,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          textAlignVertical: 'top',
        },
        style,
      ]}
    />
  );
}
