import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { detectPRs, pickLine, seedOf, volumeKg } from '@gymapp/shared';
import { useCoachStyle } from '../../src/coach/useCoachStyle';
import { en } from '../../src/copy/en';
import { supabase } from '../../src/supabase';
import { useFeedback } from '../../src/motion';
import { useTheme } from '../../src/theme';
import { Button, Card, Celebration, ChipGroup, Screen, Text, TextField, useToast } from '../../src/ui';
import { useWorkout } from '../../src/workout/WorkoutProvider';

const t = en.workout.summary;
const RATINGS = t.ratings.map((label, i) => ({ value: String(i + 1), label }));

/** After a workout: PR celebration, totals, and optional feedback (rating + short note). */
export default function WorkoutSummary() {
  const { active, hydrated, pending, close } = useWorkout();
  const router = useRouter();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const { style } = useCoachStyle();
  const feedback = useFeedback();
  const [rating, setRating] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const stats = useMemo(() => {
    if (!active) return null;
    const minutes = Math.max(1, Math.round((Date.parse(active.finishedAt ?? new Date().toISOString()) - Date.parse(active.startedAt)) / 60000));
    return {
      prs: detectPRs(active.logged, new Map(Object.entries(active.previousBest))),
      sets: active.logged.filter((l) => !l.warmup).length,
      minutes,
      volume: Math.round(volumeKg(active.logged)),
    };
  }, [active]);

  // The moment of a personal record: the success tap, once, when the summary opens (phones only).
  const hasPr = (stats?.prs.length ?? 0) > 0;
  useEffect(() => {
    if (hasPr) feedback('pr');
  }, [hasPr, feedback]);

  if (!hydrated) return null;
  if (!active || !stats) return <Redirect href="/" />;
  const nameOf = (slug: string) => active.planned.find((p) => p.slug === slug)?.name ?? slug;

  const leave = () => {
    close();
    router.replace('/');
  };

  const save = async () => {
    setBusy(true);
    setError(false);
    const { error: e } = await supabase.functions.invoke('workout-feedback', {
      body: { sessionId: active.id, rating: rating[0] ? Number(rating[0]) : undefined, note: note.trim() || undefined },
    });
    setBusy(false);
    if (e) return setError(true);
    toast.show(t.thanks, 'success');
    leave();
  };

  return (
    <Screen
      keyboardTaps
      footer={
        <>
          <Button label={t.save} loading={busy} disabled={!rating[0] && !note.trim()} onPress={() => void save()} />
          <Button label={error ? t.done : t.skip} variant="ghost" onPress={leave} />
        </>
      }
    >
        {hasPr ? <Celebration /> : null}
        <Text variant="display">{pickLine(en.coach.summaryTitle, style, seedOf(active.id))}</Text>

        {stats.prs.map((p) => (
          <Card key={p.slug} style={{ gap: spacing.xs, borderColor: colors.accent }}>
            <Text variant="heading" tone="accent">{t.pr(nameOf(p.slug), p.e1rm)}</Text>
            <Text tone="muted">{pickLine(en.coach.prCheer, style, seedOf(p.slug))}</Text>
            <Text tone="muted">{t.prDelta(Math.round((p.e1rm - p.previous) * 10) / 10)}</Text>
          </Card>
        ))}

        <Text tone="muted">{t.stats(stats.sets, stats.minutes, stats.volume)}</Text>
        {pending > 0 ? <Text variant="small" tone="muted">{t.offline}</Text> : null}

        <View style={{ gap: spacing.md }}>
          <Text variant="heading">{t.feedbackTitle}</Text>
          <ChipGroup options={RATINGS} value={rating} onChange={setRating} />
          <TextField multiline maxLength={280} value={note} placeholder={t.notePlaceholder} accessibilityLabel={t.notePlaceholder} onChangeText={setNote} />
          {error ? <Text tone="danger" accessibilityRole="alert">{t.saveError}</Text> : null}
        </View>
    </Screen>
  );
}
