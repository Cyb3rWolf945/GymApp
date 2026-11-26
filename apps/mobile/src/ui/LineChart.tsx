import { useId, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { areaPath, scaleSeries, toPath } from '@gymapp/shared';
import { drawDash, lineProgress, pointsOpacity, polylineLength, useRunProgress } from '../motion';
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
  // Each chart has its own gradient id: charts on one page must not share (or override) each other's.
  const areaId = `area-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Draw at the container's real width (re-measured on resize) so dots stay round and the line fills the card.
  const [measured, setMeasured] = useState(0);
  const W = measured > 0 ? measured - 12 : DEFAULT_W;
  // The line and the dots share the y-scale (so they line up) but each spreads over the full width on its own.
  const all = [...values, ...(dots ?? [])];
  const range = all.length ? { min: Math.min(...all), max: Math.max(...all) } : undefined;
  const line = scaleSeries(values, W, H, 8, range);
  const raw = scaleSeries(dots ?? [], W, H, 8, range);
  // The line draws left to right, then the points appear. New data (a newly logged weight) draws it again, ending on the new last point.
  const t = useRunProgress(`${values.length}:${values[values.length - 1] ?? ''}`, 700);
  const dash = drawDash(polylineLength(line), lineProgress(t));
  const dotsOpacity = pointsOpacity(t);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e: LayoutChangeEvent) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      <Svg width="100%" height={H} viewBox={`-6 0 ${W + 12} ${H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.chart[0]} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.chart[0]} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Faint guides at the top, middle and bottom of the range. */}
        {[8, H / 2, H - 8].map((y) => (
          <Line key={y} x1={-6} x2={W + 6} y1={y} y2={y} stroke={colors.divider} strokeWidth={1} opacity={0.6} />
        ))}
        {line.length > 1 ? <Path d={areaPath(line, H)} fill={`url(#${areaId})`} opacity={dotsOpacity} /> : null}
        {raw.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colors.muted} opacity={0.5 * dotsOpacity} />
        ))}
        <Path d={toPath(line)} stroke={colors.chart[0]} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash.dasharray} strokeDashoffset={dash.dashoffset} />
        {line.length > 0 ? <Circle cx={line[line.length - 1].x} cy={line[line.length - 1].y} r={4} fill={colors.chart[0]} opacity={dotsOpacity} /> : null}
      </Svg>
    </View>
  );
}
