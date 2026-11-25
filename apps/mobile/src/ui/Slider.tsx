import { type ComponentRef, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { useTheme } from '../theme';
import { fractionOf, snapToStep, valueFromPosition } from './logic';
import { Text } from './Text';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** e.g. (v) => `${v} kg` */
  format?: (value: number) => string;
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String }: Props) {
  const { colors, spacing, minTapTarget } = useTheme();
  const [width, setWidth] = useState(0);
  const track = useRef<ComponentRef<typeof View>>(null);
  const left = useRef(0);
  const latest = useRef({ width, min, max, step, onChange });
  latest.current = { width, min, max, step, onChange };

  const move = (pageX: number) => {
    const c = latest.current;
    c.onChange(valueFromPosition(pageX - left.current, c.width, c.min, c.max, c.step));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const pageX = e.nativeEvent.pageX;
        track.current?.measureInWindow((x) => {
          left.current = x;
          move(pageX);
        });
      },
      onPanResponderMove: (e) => move(e.nativeEvent.pageX),
    }),
  ).current;

  const fraction = fractionOf(value, min, max);
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="small" tone="muted">{label}</Text>
        <Text variant="bodyStrong">{format(value)}</Text>
      </View>
      <View
        ref={track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
          onChange(snapToStep(value + dir * step, min, max, step));
        }}
        {...pan.panHandlers}
        style={{ height: minTapTarget, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt }}>
          <View style={{ width: `${fraction * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, fraction * width - 14),
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.accent,
            borderWidth: 3,
            borderColor: colors.background,
          }}
        />
      </View>
    </View>
  );
}
