import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

interface Props {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

/** Big − / + buttons around a value: one-handed, no keyboard. */
export function Stepper({ label, value, step, min = 0, max = 1000, format = (v) => String(v), onChange }: Props) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const btn = (sign: -1 | 1, text: string, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label}`}
      onPress={() => onChange(clamp(value + sign * step))}
      style={({ pressed }) => ({
        width: Math.max(minTapTarget, 56),
        height: Math.max(minTapTarget, 56),
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="title">{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="small" tone="muted">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {btn(-1, '−', 'Decrease')}
        <Text variant="display" accessibilityRole="adjustable" accessibilityLabel={`${label} ${format(value)}`}>{format(value)}</Text>
        {btn(1, '+', 'Increase')}
      </View>
    </View>
  );
}
