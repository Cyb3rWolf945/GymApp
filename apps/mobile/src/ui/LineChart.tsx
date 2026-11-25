import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { scaleSeries, toPath } from '@gymapp/shared';
import { useTheme } from '../theme';

const DEFAULT_W = 320;
const H = 140;

interface Props {
  /** The line. */
  values: readonly number[];
  /** Faint dots behind the line (raw readings when the line is an average). */
  dots?: readonly number[];
  /** Read out by screen readers: charts are not visible to them. */
  label: string;
}

/** A small line chart: no axes, just the shape of the trend. The numbers are shown in text next to it. */
export function LineChart({ values, dots, label }: Props) {
  const { colors } = useTheme();
  // Draw at the container's real width (re-measured on resize) so dots stay round and the line fills the card.
  const [measured, setMeasured] = useState(0);
  const W = measured > 0 ? measured - 12 : DEFAULT_W;
  // The line and the dots share the y-scale (so they line up) but each spreads over the full width on its own.
  const all = [...values, ...(dots ?? [])];
  const range = all.length ? { min: Math.min(...all), max: Math.max(...all) } : undefined;
  const line = scaleSeries(values, W, H, 8, range);
  const raw = scaleSeries(dots ?? [], W, H, 8, range);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e: LayoutChangeEvent) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      <Svg width="100%" height={H} viewBox={`-6 0 ${W + 12} ${H}`} preserveAspectRatio="none">
        {raw.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colors.muted} opacity={0.5} />
        ))}
        <Path d={toPath(line)} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {line.length > 0 ? <Circle cx={line[line.length - 1].x} cy={line[line.length - 1].y} r={4} fill={colors.accent} /> : null}
      </Svg>
    </View>
  );
}
