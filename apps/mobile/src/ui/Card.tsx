import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme';

export function Card({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      {...rest}
      style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}
