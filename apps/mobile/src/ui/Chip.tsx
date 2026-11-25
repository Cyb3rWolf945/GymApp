import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected = false, onPress, disabled }: ChipProps) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: minTapTarget,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? colors.accent : colors.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text variant="bodyStrong" style={{ color: selected ? colors.onAccent : colors.text }}>{label}</Text>
    </Pressable>
  );
}

interface GroupProps<T extends string> {
  options: readonly { value: T; label: string }[];
  /** Selected values. Single mode keeps at most one. */
  value: readonly T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
}

export function ChipGroup<T extends string>({ options, value, onChange, multiple = false }: GroupProps<T>) {
  const { spacing } = useTheme();
  const toggle = (v: T) => {
    const on = value.includes(v);
    if (multiple) onChange(on ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(on ? [] : [v]);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </View>
  );
}
