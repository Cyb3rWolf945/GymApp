import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  GROWTH_SETS_PER_WEEK, HEAT_INTENSITY, HEAT_LEVEL_LABELS, type LibraryExercise, type MuscleId, type MuscleSet, daysSinceTrained,
  muscleDetail, muscleLabel, muscleSequence, muscleView, trainNextCandidates,
} from '@gymapp/shared';
import { en } from '../copy/en';
import { usePlanData } from '../home/usePlanData';
import { FadeSlideIn } from '../motion';
import { useTheme } from '../theme';
import { BarChart, BottomSheet, Icon, InlineSkeleton, ListItem, StatTile, Text } from '../ui';
import { fetchExerciseLibrary } from './api';
import { MuscleMap, heatPaint } from './MuscleMap';

const p = en.home.progress;
const d = p.detail;

interface Props {
  muscle: MuscleId | null;
  period: 7 | 30;
  muscleSets: MuscleSet[];
  /** Steps to another muscle (the arrows): the map follows. */
  onSelect: (muscle: MuscleId) => void;
  onClose: () => void;
}

const NO_PROFILE = { equipment: [] as string[], contraindications: [] as string[], level: 'beginner' };

/** "Today", "Yesterday", "3 days ago", or "Not yet". */
function ago(days: number | null): string {
  if (days === null) return d.notYet;
  if (days === 0) return d.today;
  if (days === 1) return d.yesterday;
  return d.daysAgo(days);
}

/**
 * What the muscle map's detail shows when you tap a muscle: its heat level, how long since you trained it, 8 weeks of
 * sets against a general guideline, the exercises that work it and what to train next. A bottom sheet on a phone, a
 * centred dialog from 600 px wide. The arrows step through the muscles of the view; the content cross-fades between them.
 */
export function MuscleSheet({ muscle, period, muscleSets, onSelect, onClose }: Props) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const router = useRouter();
  const plan = usePlanData();
  const profile = plan.state.status === 'ready' ? plan.state.data.swapProfile : NO_PROFILE;

  // The exercise library, fetched the first time a sheet opens (it is only needed for "Train it next").
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null);
  useEffect(() => {
    if (!muscle || library) return;
    let live = true;
    fetchExerciseLibrary().then(
      (rows) => live && setLibrary(rows),
      () => live && setLibrary([]),
    );
    return () => {
      live = false;
    };
  }, [muscle, library]);

  const now = useMemo(() => new Date(), [muscle, period]);
  const detail = useMemo(() => (muscle ? muscleDetail(muscle, muscleSets, now, period) : null), [muscle, muscleSets, now, period]);
  const lastDone = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of muscleSets) if (!m.get(s.slug) || s.loggedAt > m.get(s.slug)!) m.set(s.slug, s.loggedAt);
    return m;
  }, [muscleSets]);
  const next = useMemo(() => (muscle && library ? trainNextCandidates(muscle, library, profile, lastDone) : []), [muscle, library, profile, lastDone]);

  const sequence = muscle ? muscleSequence(muscleView(muscle) ?? 'front') : [];
  const at = muscle ? sequence.indexOf(muscle) : -1;
  const step = (by: 1 | -1) => (at < 0 ? null : sequence[(at + by + sequence.length) % sequence.length]);
  const previous = step(-1);
  const following = step(1);

  const openExercise = (slug: string) => {
    onClose();
    router.push({ pathname: '/exercise/[slug]', params: { slug } });
  };
  const arrow = (to: MuscleId | null, label: string, icon: 'chevron-back' | 'chevron-forward', testID: string) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!to}
      onPress={() => to && onSelect(to)}
      style={{ width: minTapTarget, height: minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, opacity: to ? 1 : 0.4 }}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  );

  const body = () => {
    if (!muscle || !detail) return null;
    const level = detail.heat;
    const bands = HEAT_LEVEL_LABELS[level];
    const heatName = p.heatNames[level];
    const copy = p.muscles[muscle];
    const paint = heatPaint(HEAT_INTENSITY[level], colors.heat);
    const week = detail.weeks[detail.weeks.length - 1].sets;
    const values = detail.weeks.map((w) => w.sets);
    const view = muscleView(muscle) ?? 'front';
    const solo = new Map([[muscle, { muscle, sets: detail.sets, lastTrained: detail.lastTrained, topExercises: [] }]]);
    const days = daysSinceTrained(detail.lastTrained, now);
    return (
      <FadeSlideIn key={muscle}>
        <View style={{ gap: spacing.lg }}>
          {/* Header: the muscle on a small body, its heat level, and the arrows. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <View testID="muscle-thumbnail" accessible accessibilityRole="image" accessibilityLabel={d.thumbnail(muscleLabel(muscle))} style={{ width: 72 }}>
              <MuscleMap view={view} stats={solo} selected={muscle} height={128} />
            </View>
            <View style={{ flex: 1, gap: spacing.md }}>
              <View
                testID="heat-chip"
                accessible
                accessibilityLabel={d.heatSpoken(heatName, bands)}
                style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: paint.fill }} />
                <Text variant="small">{d.heat(heatName, bands)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {arrow(previous, previous ? d.previous(muscleLabel(previous)) : '', 'chevron-back', 'muscle-prev')}
                {arrow(following, following ? d.nextMuscle(muscleLabel(following)) : '', 'chevron-forward', 'muscle-next')}
              </View>
            </View>
          </View>

          {detail.trained ? (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <StatTile compact label={period === 7 ? d.setsWeek : d.setsWeek30} value={String(detail.sets)} unit={d.sets} countTo={detail.sets} />
                <StatTile compact label={d.last} value={ago(days)} />
                <StatTile compact label={d.status} value={d.statusNames[detail.status]} />
              </View>
              <Text variant="small" tone="muted">{`${d.statusHints[detail.status]} ${d.statusNote}`}</Text>

              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">{d.trend}</Text>
                <BarChart values={values} band={GROWTH_SETS_PER_WEEK} label={d.trendChart(values.join(', '), d.guidelineShort)} />
                {/* What the shaded band means: the general guideline range. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 20, height: 10, borderRadius: 3, backgroundColor: colors.accent2, opacity: 0.35 }} />
                  <Text variant="small" tone="muted">{d.guidelineShort}</Text>
                </View>
                <Text variant="small" tone="muted">{`${d.trendNow(week)}. ${d.guideline}`}</Text>
              </View>

              <View style={{ gap: spacing.xs }}>
                <Text variant="bodyStrong">{d.top}</Text>
                {detail.topExercises.length === 0 ? <Text tone="muted">{d.topNone}</Text> : null}
                {detail.topExercises.map((e) => (
                  <View key={e.slug} testID="top-exercise" style={{ gap: spacing.xs }}>
                    <ListItem
                      title={e.name}
                      subtitle={`${e.role === 'primary' ? d.primary : d.secondary} · ${d.share(Math.round(e.share * 100))}`}
                      trailing={<Text variant="small" tone="muted">{p.sets(e.sets)}</Text>}
                      onPress={() => openExercise(e.slug)}
                    />
                    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginTop: -spacing.xs }}>
                      <View style={{ width: `${Math.max(2, Math.round(e.share * 100))}%`, height: 6, borderRadius: radius.pill, backgroundColor: colors.accent }} />
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text testID="muscle-empty" tone="muted">{d.empty}</Text>
          )}

          {/* What to train next: exercises for this muscle that suit your equipment, level and limits. */}
          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyStrong">{d.next}</Text>
            {library === null ? (
              <InlineSkeleton lines={2} label={en.common.loading} />
            ) : next.length === 0 ? (
              <Text tone="muted">{d.nextNone}</Text>
            ) : (
              <>
                <Text variant="small" tone="muted">{d.nextBody}</Text>
                {next.map((e) => (
                  <View key={e.slug} testID="train-next">
                    <ListItem title={e.name} onPress={() => openExercise(e.slug)} trailing={<Icon name="chevron-forward" size={18} tone="muted" />} />
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyStrong">{d.about}</Text>
            <Text testID="muscle-about">{`${muscleLabel(muscle)}: ${copy.plain}. ${copy.about}`}</Text>
          </View>
        </View>
      </FadeSlideIn>
    );
  };

  return (
    <BottomSheet visible={!!muscle} onClose={onClose} title={muscle ? muscleLabel(muscle) : undefined} closeLabel={en.common.close} dialogFrom="medium" dialogMaxWidth={480} tall focusKey={muscle ?? undefined}>
      {body()}
    </BottomSheet>
  );
}
