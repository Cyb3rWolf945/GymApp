import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme';

/** A card: surface colour, a fine border and a soft low shadow. `raised` floats higher (hero cards, dialogs' content). */
export function Card({ children, style, raised = false, ...rest }: ViewProps & { children: ReactNode; raised?: boolean }) {
  const { colors, radius, spacing, elevation } = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: raised ? colors.surfaceAlt : colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
        raised ? elevation.mid : elevation.low,
        style,
      ]}
    >
      {children}
    </View>
  );
}
