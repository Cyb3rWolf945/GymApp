import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRest, nextPosition, prefillSet, setLine } from '@gymapp/shared';
import { en } from '../../src/copy/en';
import { useTheme } from '../../src/theme';
import { Button, Card, ChipGroup, ListItem, Stepper, Text } from '../../src/ui';
import { useWorkout } from '../../src/workout/WorkoutProvider';

const t = en.workout;
const RPE_OPTIONS = ['6', '7', '8', '9', '10'].map((v) => ({ value: v, label: v }));

/** The active workout: pre-filled set, log in one tap, rest timer after each set. */
export default function WorkoutScreen() {
  const { active, hydrated, logSet, undoLast, finish } = useWorkout();
  const router = useRouter();
  const { colors, spacing } = useTheme();

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

  // Rest timer: ends `restSeconds` after the last logged set.
  const [now, setNow] = useState(Date.now());
  const [restSkipped, setRestSkipped] = useState(false);
  const lastSet = active?.logged[active.logged.length - 1];
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
    finish();
    router.replace('/workout-summary');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Text variant="small" tone="muted">{active.dayName}</Text>

        {exercise && pos ? (
          <>
            <Text variant="display">{exercise.name}</Text>
            <Text variant="bodyStrong" accessibilityLiveRegion="polite">
              {setLine(pos.set + 1, exercise.sets, weight, reps)}
              {resting ? ` · ${t.rest(formatRest(restLeft))}` : ''}
            </Text>

            <Card style={{ gap: spacing.lg }}>
              <Stepper label={t.weight} value={weight} step={2.5} format={(v) => `${v} kg`} onChange={setWeight} />
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

        {active.logged.length > 0 ? (
          <Card style={{ gap: spacing.xs }}>
            <Text variant="heading">{t.loggedTitle}</Text>
            {active.logged.map((s) => (
              <ListItem
                key={s.id}
                title={active.planned.find((p) => p.slug === s.slug)?.name ?? s.slug}
                subtitle={`${s.weightKg > 0 ? `${s.weightKg} kg × ` : ''}${s.reps}${s.rpe ? ` · RPE ${s.rpe}` : ''}`}
              />
            ))}
            <Button label={t.undo} variant="ghost" onPress={undoLast} />
          </Card>
        ) : null}

        {exercise ? <Button label={t.finish} variant="ghost" onPress={onFinish} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
