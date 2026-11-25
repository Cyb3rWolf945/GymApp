import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MAP_HEIGHT, MAP_REGIONS, MAP_WIDTH, type MapView, type MuscleId, type MuscleStat, ellipsePath, heat, muscleLabel, regionShapes } from '@gymapp/shared';
import { useTheme } from '../theme';

interface Props {
  view: MapView;
  stats: ReadonlyMap<MuscleId, MuscleStat>;
  onSelect: (muscle: MuscleId) => void;
}

/** Front or back view; each muscle is filled by last-7-days effective sets (more sets = brighter). Tap a muscle for details. */
export function MuscleMap({ view, stats, onSelect }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width="100%" height={340} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} accessibilityLabel={`Muscle map, ${view} view`}>
        {/* Body outline: head, torso, arms, legs. */}
        <Circle cx={60} cy={20} r={11} fill={colors.surfaceAlt} />
        <Path
          d="M 44 34 H 76 L 92 50 L 100 110 L 94 128 L 86 128 L 80 70 L 78 130 L 82 190 L 80 256 H 66 L 62 190 L 60 150 L 58 190 L 54 256 H 40 L 38 190 L 42 130 L 40 70 L 34 128 L 26 128 L 20 110 L 28 50 Z"
          fill={colors.surfaceAlt}
        />
        {MAP_REGIONS[view].flatMap((r) => {
          const stat = stats.get(r.muscle);
          const h = heat(stat?.sets ?? 0);
          return regionShapes(r).map((s, i) => (
            <Path
              key={`${r.muscle}-${i}`}
              d={ellipsePath(s)}
              fill={h > 0 ? colors.accent : colors.border}
              fillOpacity={h > 0 ? 0.25 + 0.75 * h : 0.6}
              stroke={colors.background}
              strokeWidth={0.8}
              accessibilityLabel={`${muscleLabel(r.muscle)}, ${stat?.sets ?? 0} sets this week`}
              onPress={() => onSelect(r.muscle)}
            />
          ));
        })}
      </Svg>
    </View>
  );
}
