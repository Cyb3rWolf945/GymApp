import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type BodyVariant, MAP_HEIGHT, MAP_WIDTH, type MapView, type MuscleId, type MuscleStat, bodyDetails, bodyOutline, bodyRegions, heat, muscleLabel, regionSets } from '@gymapp/shared';
import { plural } from '../copy/plural';
import { FadeSlideIn, blendIntensity, regionProgress, useRunProgress } from '../motion';
import { mixColors, useTheme } from '../theme';
import { pressableSvgProps } from './pressableSvg';
import { useBodyVariant } from './useBodyVariant';

interface Props {
  view: MapView;
  stats?: ReadonlyMap<MuscleId, MuscleStat>;
  onSelect?: (muscle: MuscleId) => void;
  /** The muscle whose details are open: its outline is highlighted. */
  selected?: MuscleId | null;
  /** Exercise detail: fill these muscles instead of the weekly heat (primary solid, secondary lighter). */
  highlight?: { primary: readonly MuscleId[]; secondary: readonly MuscleId[] };
  height?: number;
  /** Which body to draw. Default: from the profile's `sex`. */
  body?: BodyVariant;
}

/** Fill colour for an intensity (0 to 1): along the palette's heat ramp (base tone, then up through the accent to the hottest). */
export function heatPaint(cur: number, heatRamp: readonly string[]): { fill: string; opacity: number } {
  const pos = Math.max(0, Math.min(1, cur)) * (heatRamp.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(heatRamp.length - 1, lo + 1);
  return { fill: mixColors(heatRamp[lo], heatRamp[hi], pos - lo), opacity: 1 };
}

/** Front or back view of an anatomical figure; each muscle is filled by last-7-days effective sets (more sets = brighter). Tap a muscle for details. */
export function MuscleMap({ view, stats, onSelect, selected, highlight, height = 340, body }: Props) {
  const { colors } = useTheme();
  const fromProfile = useBodyVariant();
  const variant = body ?? fromProfile;
  const regions = useMemo(() => bodyRegions(view, variant), [view, variant]);
  const outline = useMemo(() => bodyOutline(variant), [variant]);
  const details = useMemo(() => bodyDetails(view, variant), [view, variant]);
  // Each region's target intensity (0 to 1), top to bottom. The map fills from empty on first view and animates from the
  // old intensities to the new ones when the data changes (a new workout).
  const targets = useMemo(
    () =>
      regions.map((r) => {
        const sets = regionSets(r.muscle, (m) => stats?.get(m)?.sets ?? 0);
        const role = highlight?.primary.includes(r.muscle) ? 'primary' : highlight?.secondary.includes(r.muscle) ? 'secondary' : null;
        const h = highlight ? (role === 'primary' ? 1 : role === 'secondary' ? 0.4 : 0) : heat(sets);
        return { key: r.muscle, region: r, h, role, sets };
      }),
    [regions, stats, highlight],
  );
  const signature = targets.map((t) => `${t.key}:${t.h.toFixed(2)}`).join('|');
  const t = useRunProgress(`${view}:${signature}`, 500);
  const from = useRef(new Map<string, number>());
  // Once the fill is done, the new intensities are where the next change starts from.
  useEffect(() => {
    if (t >= 1) from.current = new Map(targets.map((x) => [x.key, x.h]));
  }, [t, targets]);
  // Web keyboard focus: the region the keyboard is on gets a visible outline.
  const [focused, setFocused] = useState<string | null>(null);
  // The body: a little lighter than a card, so the figure reads on the page in both themes.
  const bodyTone = mixColors(colors.surfaceAlt, colors.text, 0.07);
  return (
    <View style={{ alignItems: 'center' }}>
      <FadeSlideIn key={view} style={{ width: '100%' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} accessibilityLabel={`Muscle map, ${view} view`}>
          {/* The body: head, neck, torso, arms, legs. */}
          {/* Outline first (one merged edge around the parts), then the fills on top. */}
          {outline.map((d, i) => (
            <Path key={`e${i}`} d={d} fill={colors.divider} stroke={colors.divider} strokeWidth={1.4} strokeLinejoin="round" />
          ))}
          {outline.map((d, i) => (
            <Path key={`o${i}`} d={d} fill={bodyTone} />
          ))}
          {targets.map((r, i) => {
            const cur = blendIntensity(from.current.get(r.key) ?? 0, r.h, regionProgress(t, i, targets.length));
            const label = highlight ? `${muscleLabel(r.key)}${r.role ? `, ${r.role}` : ''}` : `${muscleLabel(r.key)}, ${plural(r.sets, 'set')} this week`;
            const on = selected === r.key || focused === r.key;
            const paint = heatPaint(cur, colors.heat);
            return (
              <Path
                key={r.key}
                d={r.region.d}
                fill={paint.fill}
                fillOpacity={paint.opacity}
                stroke={on ? colors.text : colors.background}
                strokeWidth={on ? 1.6 : 0.6}
                strokeLinejoin="round"
                // With taps, the (larger) tap areas below carry the label; without, the region does.
                {...(onSelect ? {} : { accessibilityLabel: label })}
              />
            );
          })}
          {/* Thin lines inside the figure: abs, pec edge, quad heads, spine. */}
          {details.map((d, i) => (
            <Path key={`d${i}`} d={d} fill="none" stroke={colors.background} strokeOpacity={0.55} strokeWidth={0.5} strokeLinecap="round" />
          ))}
          {/* Tap areas: each region again, transparent, with a margin so small muscles are easy to hit. */}
          {onSelect
            ? targets.flatMap((r) =>
                r.region.parts.map((d, i) => (
                  <Path
                    key={`${r.key}-hit${i}`}
                    d={d}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={5}
                    accessibilityLabel={highlight ? `${muscleLabel(r.key)}${r.role ? `, ${r.role}` : ''}` : `${muscleLabel(r.key)}, ${plural(r.sets, 'set')} this week`}
                    {...pressableSvgProps(() => onSelect(r.key), Platform.OS, {
                      onFocus: (e) => setFocused((e as { target?: { matches?: (q: string) => boolean } }).target?.matches?.(':focus-visible') ? r.key : null),
                      onBlur: () => setFocused(null),
                    })}
                  />
                )),
              )
            : null}
        </Svg>
      </FadeSlideIn>
    </View>
  );
}
