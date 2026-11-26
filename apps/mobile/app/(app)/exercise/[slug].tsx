import { createElement, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WorkoutPlanSchema, exerciseHistory, mediaKind, muscleLabel, parseSteps, type SetRecord } from '@gymapp/shared';
import { useAuth } from '../../../src/auth/AuthProvider';
import { en } from '../../../src/copy/en';
import { type ExerciseDetail, fetchExerciseDetail, fetchExerciseSets } from '../../../src/exercise/api';
import { type PlanData, PlanDataProvider, usePlanData } from '../../../src/home/usePlanData';
import { SwapSheet } from '../../../src/plan/SwapSheet';
import { MuscleMap } from '../../../src/progress/MuscleMap';
import { useBreakpoint, useTheme } from '../../../src/theme';
import { Button, Card, EmptyState, InlineSkeleton, LineChart, ListItem, Screen, ScreenSkeleton, Text } from '../../../src/ui';

const x = en.exercise;

type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

/** An image, or a video on web; on phones a video opens in the system player. Nothing renders if it is missing or fails to load. */
function Media({ url, name }: { url: string | null; name: string }) {
  const { radius, colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const kind = failed ? null : mediaKind(url);
  if (!url || !kind) return null;
  if (kind === 'image') {
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel={x.media(name)}
        resizeMode="contain"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: 240, borderRadius: radius.md, backgroundColor: colors.surface }}
      />
    );
  }
  if (Platform.OS === 'web') {
    return createElement('video', {
      src: url,
      controls: true,
      muted: true,
      loop: true,
      playsInline: true,
      'aria-label': x.media(name),
      onError: () => setFailed(true),
      style: { width: '100%', maxHeight: 320, borderRadius: radius.md, backgroundColor: colors.surface },
    });
  }
  return <Button label={x.watchVideo} variant="secondary" onPress={() => void Linking.openURL(url)} />;
}

function Muscles({ detail }: { detail: ExerciseDetail }) {
  const { spacing } = useTheme();
  const { primary, secondary } = detail.roles;
  if (primary.length === 0 && secondary.length === 0) return null;
  const names = (ids: readonly string[]) => ids.map(muscleLabel).join(', ');
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="heading">{x.muscles}</Text>
      <View accessible accessibilityLabel={x.musclesLabel(names(primary), names(secondary))} style={{ flexDirection: 'row', gap: spacing.md }}>
        {(['front', 'back'] as const).map((view) => (
          <View key={view} style={{ flex: 1, alignItems: 'center' }}>
            <MuscleMap view={view} highlight={detail.roles} height={260} />
            <Text variant="small" tone="muted">{x[view]}</Text>
          </View>
        ))}
      </View>
      {primary.length ? <Text>{`${x.primary}: ${names(primary)}`}</Text> : null}
      {secondary.length ? <Text tone="muted">{`${x.secondary}: ${names(secondary)}`}</Text> : null}
    </Card>
  );
}

function History({ slug, name }: { slug: string; name: string }) {
  const { user } = useAuth();
  const { spacing } = useTheme();
  const [state, setState] = useState<Load<SetRecord[]>>({ status: 'loading' });
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchExerciseSets(user.id, slug).then(
      (value) => active && setState({ status: 'ready', value }),
      () => active && setState({ status: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [user, slug]);
  const h = useMemo(() => (state.status === 'ready' ? exerciseHistory(state.value, slug) : null), [state, slug]);

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="heading">{x.history}</Text>
      {state.status === 'loading' ? <InlineSkeleton lines={4} label={en.common.loading} /> : null}
      {state.status === 'error' ? <Text tone="danger" accessibilityRole="alert">{x.historyError}</Text> : null}
      {h && h.sessions.length === 0 ? <Text tone="muted">{x.historyEmpty}</Text> : null}
      {h && h.sessions.length > 0 ? (
        <>
          {h.bestE1rm !== null ? <Text variant="bodyStrong">{x.best(h.bestE1rm)}</Text> : null}
          {h.trend.length >= 2 ? <LineChart values={h.trend.map((p) => p.e1rm)} label={x.trendChart(name, h.trend.length)} /> : null}
          {h.sessions.map((s) => (
            <ListItem key={s.date} title={s.date} subtitle={x.sessionLine(s.weightKg, s.reps)} />
          ))}
        </>
      ) : null}
    </Card>
  );
}

/** The day of the plan this exercise is in (the one it was opened from if it still has it), for "Swap exercise". */
function dayOf(data: PlanData, slug: string, hint: number): number | null {
  const parsed = WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan);
  if (!parsed.success) return null;
  const has = (i: number) => parsed.data.days[i]?.exercises.some((e) => e.exerciseSlug === slug) ?? false;
  if (Number.isInteger(hint) && has(hint)) return hint;
  const i = parsed.data.days.findIndex((d) => d.exercises.some((e) => e.exerciseSlug === slug));
  return i >= 0 ? i : null;
}

function ExerciseBody({ slug, day }: { slug: string; day: number }) {
  const router = useRouter();
  const wide = useBreakpoint() !== 'compact';
  const { spacing } = useTheme();
  const { state: plan, reload } = usePlanData();
  const [state, setState] = useState<Load<ExerciseDetail | null>>({ status: 'loading' });
  const [swapOpen, setSwapOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    fetchExerciseDetail(slug).then(
      (value) => active && setState({ status: 'ready', value }),
      () => active && setState({ status: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [slug]);

  const body = () => {
    if (state.status === 'loading') return <ScreenSkeleton title={false} label={en.common.loading} />;
    if (state.status === 'error') return <EmptyState kind="error" title={x.loadError} actionLabel={en.common.retry} onAction={() => router.replace({ pathname: '/exercise/[slug]', params: { slug } })} />;
    if (!state.value) return <EmptyState kind="missing" title={x.missing} />;
    const ex = state.value;
    const steps = parseSteps(ex.instructions);
    const dayIndex = plan.status === 'ready' ? dayOf(plan.data, slug, day) : null;
    const colStyle = { flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: spacing.xl } as const;
    return (
      <>
        <Text variant="display">{ex.name}</Text>
        {ex.equipment ? <Text tone="muted">{x.equipment(ex.equipment.replace(/_/g, ' '))}</Text> : null}
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.xl }}>
          <View style={colStyle}>
            <Media url={ex.mediaUrl} name={ex.name} />
            <Card style={{ gap: spacing.sm }}>
              <Text variant="heading">{x.steps}</Text>
              {steps.length === 0 ? <Text tone="muted">{x.noSteps}</Text> : null}
              {steps.map((s, i) => (
                <Text key={i}>{`${i + 1}. ${s}`}</Text>
              ))}
            </Card>
            {plan.status === 'ready' && dayIndex !== null ? (
              <Card style={{ gap: spacing.sm }}>
                <Text tone="muted">{x.swapHint}</Text>
                <Button label={en.home.swap.action} variant="secondary" onPress={() => setSwapOpen(true)} />
                <SwapSheet
                  target={swapOpen ? { dayIndex, slug, name: ex.name } : null}
                  data={plan.data}
                  onClose={() => setSwapOpen(false)}
                  onSwapped={() => {
                    setSwapOpen(false);
                    reload();
                    router.back();
                  }}
                />
              </Card>
            ) : null}
          </View>
          <View style={colStyle}>
            <Muscles detail={ex} />
            <History slug={slug} name={ex.name} />
          </View>
        </View>
      </>
    );
  };

  return (
    <Screen variant="dashboard" style={{ gap: spacing.lg }}>
      {body()}
      <Button label={en.common.back} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

export default function ExerciseScreen() {
  const { slug, day } = useLocalSearchParams<{ slug: string; day?: string }>();
  return (
    <PlanDataProvider>
      <ExerciseBody slug={String(slug)} day={Number(day)} />
    </PlanDataProvider>
  );
}
