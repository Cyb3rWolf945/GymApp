import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatRest, restFraction } from '@gymapp/shared';
import { useTheme } from '../theme';
import { Text } from '../ui';

const SIZE = 168;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * The rest timer as a ring that empties as the seconds go, with the time left in the middle. The text line above it
 * ("Set 2 of 4 · Rest 1:30") is what screen readers get, so the ring is hidden from them.
 */
export function RestRing({ left, total }: { left: number; total: number }) {
  const { colors } = useTheme();
  const f = restFraction(left, total);
  return (
    <View testID="rest-ring" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ alignSelf: 'center', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.surfaceAlt} strokeWidth={STROKE} fill="none" />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.accent} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - f)} />
      </Svg>
      <Text variant="display">{formatRest(left)}</Text>
    </View>
  );
}
