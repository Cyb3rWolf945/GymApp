import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { en } from '../../src/copy/en';
import { type WeeklyChanges, fetchPendingWeekly, resolveWeekly } from '../../src/plan/weekly';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, ListItem, Screen, ScreenSkeleton, Text, useToast } from '../../src/ui';

const t = en.home.weekly;

/** "What changed this week": the differences, then Keep new plan or Go back to last week. */
export default function WeeklyChangesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { spacing } = useTheme();
  const [data, setData] = useState<WeeklyChanges | null | 'loading' | 'error'>('loading');
  const [busy, setBusy] = useState<'keep' | 'revert' | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setData('loading');
    fetchPendingWeekly(user.id).then((v) => active && setData(v), () => active && setData('error'));
    return () => {
      active = false;
    };
  }, [user, attempt]);

  const decide = async (keep: boolean) => {
    if (!data || data === 'loading' || data === 'error') return;
    setBusy(keep ? 'keep' : 'revert');
    setFailed(false);
    const ok = await resolveWeekly(data.week, keep);
    setBusy(null);
    if (!ok) return setFailed(true);
    toast.show(keep ? t.kept : t.reverted, 'success');
    router.replace('/plan');
  };

  const ready = data !== 'loading' && data !== 'error' && data !== null;
  return (
    <Screen
      center={data === 'loading'}
      footer={
        ready ? (
          <>
            <Button label={t.keep} loading={busy === 'keep'} disabled={busy !== null} onPress={() => void decide(true)} />
            <Button label={t.revert} variant="secondary" loading={busy === 'revert'} disabled={busy !== null} onPress={() => void decide(false)} />
          </>
        ) : data === null || data === 'error' ? (
          <Button label={en.home.update.back} onPress={() => router.replace('/plan')} />
        ) : null
      }
    >
      {data === 'loading' ? <ScreenSkeleton title={false} cards={1} label={en.common.loading} /> : null}
      {data === 'error' ? <EmptyState title={t.loadError} actionLabel={en.common.retry} onAction={() => setAttempt((n) => n + 1)} /> : null}
      {data === null ? (
        <>
          <Text variant="display">{t.title}</Text>
          <Text tone="muted">{t.noChanges}</Text>
        </>
      ) : null}
      {ready ? (
        <>
          <Text variant="display">{t.title}</Text>
          <Text tone="muted">{t.intro}</Text>
          {data.note ? <Text variant="bodyStrong">{data.note}</Text> : null}
          {data.workout.length === 0 && data.meals.length === 0 ? <Text tone="muted">{t.noChanges}</Text> : null}
          {data.workout.length > 0 ? (
            <Card style={{ gap: spacing.xs }}>
              <Text variant="heading">{en.home.update.workoutChanges}</Text>
              {data.workout.map((c, i) => (
                <ListItem key={`w${i}`} title={`${c.where}: ${c.text}`} subtitle={c.why} />
              ))}
            </Card>
          ) : null}
          {data.meals.length > 0 ? (
            <Card style={{ gap: spacing.xs }}>
              <Text variant="heading">{en.home.update.mealChanges}</Text>
              {data.meals.map((c, i) => (
                <ListItem key={`m${i}`} title={`${c.where}: ${c.text}`} subtitle={c.why} />
              ))}
            </Card>
          ) : null}
          {failed ? <Text tone="danger" accessibilityRole="alert">{t.saveError}</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}
