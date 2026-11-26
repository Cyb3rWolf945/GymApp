import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MAP_HEIGHT, MAP_REGIONS, MAP_WIDTH, type MapView, type MuscleId, type MuscleStat, ellipsePath, heat, muscleLabel, regionShapes } from '@gymapp/shared';
import { plural } from '../copy/plural';
import { blendIntensity, regionProgress, useRunProgress } from '../motion';
import { useTheme } from '../theme';
import { pressableSvgProps } from './pressableSvg';

interface Props {
  view: MapView;
  stats?: ReadonlyMap<MuscleId, MuscleStat>;
  onSelect?: (muscle: MuscleId) => void;
  /** Exercise detail: fill these muscles instead of the weekly heat (primary solid, secondary lighter). */
  highlight?: { primary: readonly MuscleId[]; secondary: readonly MuscleId[] };
  height?: number;
}

/** Front or back view; each muscle is filled by last-7-days effective sets (more sets = brighter). Tap a muscle for details. */
export function MuscleMap({ view, stats, onSelect, highlight, height = 340 }: Props) {
  const { colors } = useTheme();
  // Each region's target intensity (0 to 1), in drawing order (top to bottom). The map fills from empty on first view and
  // animates from the old intensities to the new ones when the data changes (a new workout).
  const targets = useMemo(
    () =>
      MAP_REGIONS[view].flatMap((r) => {
        const stat = stats?.get(r.muscle);
        const role = highlight?.primary.includes(r.muscle) ? 'primary' : highlight?.secondary.includes(r.muscle) ? 'secondary' : null;
        const h = highlight ? (role === 'primary' ? 1 : role === 'secondary' ? 0.4 : 0) : heat(stat?.sets ?? 0);
        return regionShapes(r).map((shape, i) => ({ key: `${r.muscle}-${i}`, muscle: r.muscle, shape, h, role, sets: stat?.sets ?? 0, y: shape.cy }));
      }),
    [view, stats, highlight],
  );
  const ordered = useMemo(() => [...targets].sort((a, b) => a.y - b.y), [targets]);
  const signature = targets.map((t) => `${t.key}:${t.h.toFixed(2)}`).join('|');
  const t = useRunProgress(`${view}:${signature}`, 500);
  const from = useRef(new Map<string, number>());
  // Once the fill is done, the new intensities are where the next change starts from.
  useEffect(() => {
    if (t >= 1) from.current = new Map(targets.map((x) => [x.key, x.h]));
  }, [t, targets]);
  // Web keyboard focus: the region the keyboard is on gets a visible outline (SVG has no CSS outline of its own here).
  const [focused, setFocused] = useState<string | null>(null);
  const order = new Map(ordered.map((x, i) => [x.key, i]));
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} accessibilityLabel={`Muscle map, ${view} view`}>
        {/* Body outline: head, torso, arms, legs. */}
        <Circle cx={60} cy={20} r={11} fill={colors.surfaceAlt} />
        <Path
          d="M 44 34 H 76 L 92 50 L 100 110 L 94 128 L 86 128 L 80 70 L 78 130 L 82 190 L 80 256 H 66 L 62 190 L 60 150 L 58 190 L 54 256 H 40 L 38 190 L 42 130 L 40 70 L 34 128 L 26 128 L 20 110 L 28 50 Z"
          fill={colors.surfaceAlt}
        />
        {targets.map((r) => {
          const cur = blendIntensity(from.current.get(r.key) ?? 0, r.h, regionProgress(t, order.get(r.key) ?? 0, ordered.length));
          const label = highlight ? `${muscleLabel(r.muscle)}${r.role ? `, ${r.role}` : ''}` : `${muscleLabel(r.muscle)}, ${plural(r.sets, 'set')} this week`;
          return (
            <Path
              key={r.key}
              d={ellipsePath(r.shape)}
              fill={cur > 0.001 ? colors.accent : colors.border}
              // Empty regions are the neutral tone; as they fill the accent comes in with the intensity.
              fillOpacity={cur > 0.001 ? Math.min(1, (0.25 + 0.75 * cur) * Math.min(1, cur * 6)) : 0.6}
              stroke={focused === r.key ? colors.text : colors.background}
              strokeWidth={focused === r.key ? 2 : 0.8}
              accessibilityLabel={label}
              {...pressableSvgProps(onSelect ? () => onSelect(r.muscle) : undefined, Platform.OS, {
                onFocus: (e) => setFocused((e as { target?: { matches?: (q: string) => boolean } }).target?.matches?.(':focus-visible') ? r.key : null),
                onBlur: () => setFocused(null),
              })}
            />
          );
        })}
      </Svg>
    </View>
  );
}
