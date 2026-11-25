import { trackEvent } from '../../src/analytics/track';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { firstBarbellCompound, formatRest, nextPosition, platesPerSide, prefillSet, setLine, toUnit, warmupSets } from '@gymapp/shared';
import { en } from '../../src/copy/en';
import { useBreakpoint, useTheme } from '../../src/theme';
import { BottomSheet, Button, Card, ChipGroup, ListItem, Screen, Stepper, Text } from '../../src/ui';
import { usePlateConfig } from '../../src/workout/plateSettings';
import { useWorkout } from '../../src/workout/WorkoutProvider';

const t = en.workout;
const RPE_OPTIONS = ['6', '7', '8', '9', '10'].map((v) => ({ value: v, label: v }));

/** The active workout: pre-filled set, log in one tap, rest timer after each set. */
export default function WorkoutScreen() {
  const { active, hydrated, logSet, undoLast, finish } = useWorkout();
  const router = useRouter();
  const { spacing } = useTheme();
  const wide = useBreakpoint() === 'expanded';
  const { config: plateCfg } = usePlateConfig();
  const [platesOpen, setPlatesOpen] = useState(false);
  const [warmupSkipped, setWarmupSkipped] = useState(false);

  const pos = useMemo(() => (active ? nextPosition(active.planned, active.logged) : null), [active]);
  const exercise = active && pos ? active.planned[pos.exercise] : null;

  // Values for the next set. Reset to the pre-fill whenever the position changes.
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [rpe, setRpe] = useState<string[]>([]);
  const key = pos ? `${pos.exercise}:${pos.set}` : 'done';
  useEffect(() => {
    if (!active || !exercise) return;
    const p = prefillSet(exercise, active.logged, active.lastWorkout[exercise.slug]);
    setWeight(p.weightKg);
    setReps(p.reps);
    setRpe([]);
    // Only when the position changes, not on every keystroke of the steppers.
  }, [key]);

  // Warm-up suggestions: only before the first working set of the workout's first barbell compound lift.
  const compound = active ? firstBarbellCompound(active.planned.map((p) => p.slug)) : null;
  const warmups = useMemo(
    () => (active && exercise && pos && exercise.slug === compound && !active.logged.some((l) => l.slug === exercise.slug) ? warmupSets(weight, plateCfg) : []),
    [active, exercise, pos, compound, weight, plateCfg],
  );

  // Rest timer: ends `restSeconds` after the last logged set.
  const [now, setNow] = useState(Date.now());
  const [restSkipped, setRestSkipped] = useState(false);
  const lastSet = active?.logged.filter((l) => !l.warmup).at(-1);
  const lastPlanned = lastSet && active ? active.planned.find((p) => p.slug === lastSet.slug) : undefined;
  const restEndsAt = lastSet && lastPlanned ? Date.parse(lastSet.loggedAt) + lastPlanned.restSeconds * 1000 : 0;
  const restLeft = Math.max(0, Math.ceil((restEndsAt - now) / 1000));
  useEffect(() => {
    setRestSkipped(false);
  }, [lastSet?.id]);
  useEffect(() => {
    if (restLeft <= 0) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [restLeft > 0, lastSet?.id]);
  const resting = !!lastSet && restLeft > 0 && !restSkipped && !!pos;

  if (!hydrated) return null;
  if (!active || active.finishedAt) return <Redirect href="/" />;

  const onFinish = () => {
    const done = finish();
    if (done) trackEvent('workout_logged', { sets: done.sets, minutes: done.minutes });
    router.replace('/workout-summary');
  };

  return (
    <Screen variant={wide ? 'dashboard' : 'reading'}>
        <Text variant="small" tone="muted">{active.dayName}</Text>

        {/* On wide screens: the set and rest-timer panel on the left, the logged sets on the right. */}
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.xl }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: spacing.xl }}>
        {exercise && pos ? (
          <>
            <Text variant="display">{exercise.name}</Text>
            {/* Opens the exercise page on top of the workout: the set in progress and the rest timer stay as they are. */}
            <Button label={t.info} variant="ghost" onPress={() => router.push({ pathname: '/exercise/[slug]', params: { slug: exercise.slug } })} />
            <Text variant="bodyStrong" accessibilityLiveRegion="polite">
              {setLine(pos.set + 1, exercise.sets, weight, reps)}
              {resting ? ` · ${t.rest(formatRest(restLeft))}` : ''}
            </Text>

            {warmups.length > 0 && !warmupSkipped ? (
              <Card style={{ gap: spacing.sm }}>
                <Text variant="heading">{t.warmup.title}</Text>
                <Text tone="muted">{t.warmup.body}</Text>
                {warmups.map((w, i) => (
                  <Text key={i}>{t.warmup.set(w.weight, plateCfg.unit, w.reps, i === 0 && w.weight === plateCfg.bar)}</Text>
                ))}
                <Button
                  label={t.warmup.log}
                  onPress={() => {
                    logSet(warmups.map((w) => ({ slug: exercise.slug, weightKg: w.weightKg, reps: w.reps, warmup: true })));
                    setWarmupSkipped(true);
                  }}
                />
                <Button label={t.warmup.skip} variant="ghost" onPress={() => setWarmupSkipped(true)} />
              </Card>
            ) : null}

            <Card style={{ gap: spacing.lg }}>
              <Stepper label={t.weight} value={weight} step={2.5} format={(v) => `${v} kg`} onChange={setWeight} />
              {weight > 0 ? <Button label={t.plates.open(toUnit(weight, plateCfg.unit), plateCfg.unit)} variant="ghost" onPress={() => setPlatesOpen(true)} /> : null}
              <Stepper label={t.reps} value={reps} step={1} min={1} max={100} onChange={setReps} />
              <View style={{ gap: spacing.sm }}>
                <Text variant="small" tone="muted">{t.effort}</Text>
                <ChipGroup options={RPE_OPTIONS} value={rpe} onChange={setRpe} />
              </View>
            </Card>

            <Button
              label={t.logSet}
              onPress={() => logSet({ slug: exercise.slug, weightKg: weight, reps, rpe: rpe[0] ? Number(rpe[0]) : undefined })}
            />
            {resting ? <Button label={t.skipRest} variant="secondary" onPress={() => setRestSkipped(true)} /> : null}
          </>
        ) : (
          <View style={{ gap: spacing.lg }}>
            <Text variant="display">{t.allDone}</Text>
            <Button label={t.finish} onPress={onFinish} />
          </View>
        )}
        </View>

        {active.logged.length > 0 ? (
          <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
          <Card style={{ gap: spacing.xs }}>
            <Text variant="heading">{t.loggedTitle}</Text>
            {active.logged.map((s) => (
              <ListItem
                key={s.id}
                title={active.planned.find((p) => p.slug === s.slug)?.name ?? s.slug}
                subtitle={`${s.warmup ? `${t.warmup.label} · ` : ''}${s.weightKg > 0 ? `${s.weightKg} kg × ` : ''}${s.reps}${s.rpe ? ` · RPE ${s.rpe}` : ''}`}
              />
            ))}
            <Button label={t.undo} variant="ghost" onPress={undoLast} />
          </Card>
          </View>
        ) : null}
        </View>

        {exercise ? <Button label={t.finish} variant="ghost" onPress={onFinish} /> : null}

        <BottomSheet visible={platesOpen} onClose={() => setPlatesOpen(false)} title={t.plates.title}>
          <PlatesBody weightKg={weight} />
        </BottomSheet>
    </Screen>
  );
}

/** The plates for the weight in the stepper, in the person's unit. */
function PlatesBody({ weightKg }: { weightKg: number }) {
  const { config } = usePlateConfig();
  const { spacing } = useTheme();
  const t = en.workout.plates;
  const w = toUnit(weightKg, config.unit);
  const r = platesPerSide(w, config);
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="bodyStrong">{t.total(w, config.unit)}</Text>
      <Text tone="muted">{t.barLine(config.bar, config.unit)}</Text>
      {r.ok ? (
        r.barOnly ? (
          <Text>{t.barOnly}</Text>
        ) : (
          r.perSide.map((s) => <Text key={s.plate} variant="heading">{t.side(s.count, s.plate, config.unit)}</Text>)
        )
      ) : r.reason === 'below_bar' ? (
        <Text tone="danger" accessibilityRole="alert">{t.below(config.bar, config.unit)}</Text>
      ) : r.reason === 'not_loadable' ? (
        <Text tone="danger" accessibilityRole="alert">{t.noMatch(r.nearest.lower, r.nearest.higher, config.unit)}</Text>
      ) : (
        <Text tone="muted">{t.invalid}</Text>
      )}
      <Text variant="small" tone="muted">{t.settingsHint}</Text>
    </View>
  );
}
