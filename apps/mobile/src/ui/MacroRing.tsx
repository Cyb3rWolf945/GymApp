import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { macroShares } from '@gymapp/shared';
import { useTheme } from '../theme';
import { Text } from './Text';

interface Props {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  size?: number;
  /** Read by screen readers instead of the drawing (the numbers are also shown as text next to the ring). */
  label: string;
}

const GAP = 0.012; // a small gap between the arcs, as a share of the circle

/**
 * A ring split into protein, carbs and fat by the calories each gives, with the kcal in the middle. The drawing is
 * decoration: the label says the same in words.
 */
export function MacroRing({ kcal, proteinG, carbsG, fatG, size = 96, label }: Props) {
  const { colors } = useTheme();
  const stroke = Math.max(8, Math.round(size / 9));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const s = macroShares(proteinG, carbsG, fatG);
  const parts = [
    { key: 'protein', share: s.protein, color: colors.chart[0] },
    { key: 'carbs', share: s.carbs, color: colors.accent2 },
    { key: 'fat', share: s.fat, color: colors.success },
  ].filter((p) => p.share > 0);
  let start = 0;
  return (
    <View testID="macro-ring" accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }} aria-hidden>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {parts.map((p) => {
          const gap = parts.length > 1 ? GAP : 0;
          const len = Math.max(0, p.share - gap) * c;
          const el = (
            <Circle
              key={p.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${len} ${c}`}
              strokeDashoffset={-start * c}
            />
          );
          start += p.share;
          return el;
        })}
      </Svg>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center' }}>
        <Text variant="heading">{Math.round(kcal)}</Text>
        <Text variant="small" tone="muted">kcal</Text>
      </View>
    </View>
  );
}
