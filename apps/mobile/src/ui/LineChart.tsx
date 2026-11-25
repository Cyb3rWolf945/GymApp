import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { scaleSeries, toPath } from '@gymapp/shared';
import { useTheme } from '../theme';

const W = 320;
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
  // Dots and line share one scale so they line up.
  const all = [...values, ...(dots ?? [])];
  const scaled = scaleSeries(all, W, H);
  const line = scaled.slice(0, values.length);
  const raw = scaled.slice(values.length);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {raw.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colors.muted} opacity={0.5} />
        ))}
        <Path d={toPath(line)} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {line.length > 0 ? <Circle cx={line[line.length - 1].x} cy={line[line.length - 1].y} r={4} fill={colors.accent} /> : null}
      </Svg>
    </View>
  );
}
