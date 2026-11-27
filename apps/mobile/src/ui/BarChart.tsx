import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { scaleBars } from '@gymapp/shared';
import { useRunProgress } from '../motion';
import { useTheme } from '../theme';

const DEFAULT_W = 320;
const H = 120;

/** Eased 0 to 1: the bars rise quickly and settle (not on the native driver, like the other charts). */
const rise = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * Bars over time, the latest one in the brand colour and the rest softer. They grow from the baseline when the data
 * appears or changes; with reduced motion they are simply there. The numbers are always shown as text next to it.
 */
export function BarChart({ values, label, band }: { values: readonly number[]; label: string; /** A reference band behind the bars (for example 10 to 20 sets a week): shares the bars' scale. */ band?: { min: number; max: number } }) {
  const { colors } = useTheme();
  const [measured, setMeasured] = useState(0);
  const W = measured > 0 ? measured : DEFAULT_W;
  const bars = scaleBars(values, W, H, 6, 4, 3, band?.max ?? 0);
  const bandY = (v: number) => H - (v / Math.max(band?.max ?? 1, ...values, 1)) * (H - 4);
  const t = rise(useRunProgress(`${values.length}:${values[values.length - 1] ?? ''}`, 600));
  return (
    <View testID="bar-chart" accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e: LayoutChangeEvent) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {band ? <Rect testID="bar-band" x={0} y={bandY(band.max)} width={W} height={Math.max(2, bandY(band.min) - bandY(band.max))} fill={colors.accent2} opacity={0.22} /> : null}
        {bars.map((b, i) => {
          const h = b.height * t;
          const latest = i === bars.length - 1;
          return <Rect key={i} x={b.x} y={H - h} width={b.width} height={h} rx={Math.min(4, b.width / 2)} fill={colors.chart[0]} opacity={latest ? 1 : 0.4} />;
        })}
      </Svg>
    </View>
  );
}
