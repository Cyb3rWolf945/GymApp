import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SET_EDIT_LIMITS, type OutboxItem, type SessionInfo, type SessionSet, applyQueuedEdits, buildSessionDetail, sessionDeleteItem, sessionIsDeleted, setDeleteItem, setEditItem, validateSetEdit,
} from '@gymapp/shared';
import { useAuth } from '../../../src/auth/AuthProvider';
import { en } from '../../../src/copy/en';
import { fetchSession } from '../../../src/history/api';
import { useTheme } from '../../../src/theme';
import { BottomSheet, Button, Card, ChipGroup, EmptyState, ListItem, Screen, ScreenSkeleton, Text, TextField, useToast } from '../../../src/ui';
import { useWorkout } from '../../../src/workout/WorkoutProvider';

const t = en.workout.history;
const d = t.detail;
const RPE_OPTIONS = ['6', '7', '8', '9', '10'].map((v) => ({ value: v, label: v }));
const parseNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.replace(',', '.')));

type Loaded = { session: SessionInfo; sets: SessionSet[] } | null | undefined | 'error'; // undefined = loading, null = gone

/**
 * One past workout: every set, and a way to fix a mistake. Corrections and deletes go through the same offline queue as
 * new sets, so they work without a connection and show at once; Progress recalculates once they are saved.
 */
export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id);
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { spacing } = useTheme();
  const { outbox, queue } = useWorkout();
  const [loaded, setLoaded] = useState<Loaded>(undefined);

  const load = useCallback(() => {
    setLoaded(undefined);
    fetchSession(sessionId).then(setLoaded, () => setLoaded('error'));
  }, [sessionId]);
  useEffect(load, [load]);

  const deleted = sessionIsDeleted(sessionId, outbox);
  const shown = useMemo(() => (loaded && loaded !== 'error' ? applyQueuedEdits(loaded.sets, sessionId, outbox) : []), [loaded, sessionId, outbox]);
  const detail = useMemo(() => (loaded && loaded !== 'error' ? buildSessionDetail(loaded.session, shown) : null), [loaded, shown]);
  const waiting = outbox.some((i) => (i.table === 'set_logs' && i.row.session_id === sessionId) || i.id === sessionId || shown.some((s) => s.id === i.id));

  const [editing, setEditing] = useState<{ set: SessionSet; title: string } | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'set' | 'workout' | null>(null);

  /** Once a correction has been sent it leaves the queue: keep it in the loaded copy too, so the screen never falls back to the old value. */
  const keep = (item: OutboxItem) =>
    setLoaded((cur) => (cur && cur !== 'error' ? { ...cur, sets: applyQueuedEdits(cur.sets, sessionId, [item]) } : cur));

  const open = (set: SessionSet, title: string) => {
    setEditing({ set, title });
    setWeight(String(set.weightKg ?? 0));
    setReps(String(set.reps ?? 0));
    setRpe(set.rpe === null ? [] : [String(set.rpe)]);
    setErrors([]);
  };

  const save = () => {
    if (!editing || !user) return;
    const edit = { weightKg: parseNumber(weight), reps: parseNumber(reps), rpe: rpe[0] ? Number(rpe[0]) : null };
    const bad = validateSetEdit(edit);
    if (bad.length > 0) return setErrors(bad);
    const item = setEditItem(user.id, sessionId, editing.set, edit);
    queue(item);
    keep(item);
    setEditing(null);
    toast.show(d.saved, 'success');
  };
  const removeSet = () => {
    if (!editing) return;
    const item = setDeleteItem(editing.set.id);
    queue(item);
    keep(item);
    setConfirm(null);
    setEditing(null);
    toast.show(d.setDeleted, 'success');
  };
  const removeWorkout = () => {
    queue(sessionDeleteItem(sessionId));
    setConfirm(null);
    toast.show(d.workoutDeleted, 'success');
    router.back();
  };

  const L = SET_EDIT_LIMITS;
  const message: Record<string, string> = { weight: d.errors.weight(L.weightKg.min, L.weightKg.max), reps: d.errors.reps(L.reps.min, L.reps.max), rpe: d.errors.rpe(L.rpe.min, L.rpe.max) };

  if (loaded === undefined) return <Screen><ScreenSkeleton label={en.common.loading} /></Screen>;
  if (loaded === 'error') return <Screen center><EmptyState title={d.loadError} actionLabel={en.common.retry} onAction={load} /></Screen>;
  if (loaded === null || deleted || !detail) return <Screen center><EmptyState title={d.notFound} actionLabel={en.common.back} onAction={() => router.back()} /></Screen>;

  const date = new Date(detail.startedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Screen footer={<Button label={en.common.back} variant="ghost" onPress={() => router.back()} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display" accessibilityRole="header">{detail.title ?? d.fallbackTitle}</Text>
        <Text tone="muted">{date}</Text>
        <Text tone="muted">{d.stats(detail.minutes, detail.totalSets, detail.volume)}</Text>
        {detail.rating ? <Text tone="muted">{d.rating(en.workout.summary.ratings[detail.rating - 1] ?? String(detail.rating))}</Text> : null}
        {waiting ? <Text variant="small" tone="muted" accessibilityLiveRegion="polite">{d.queued}</Text> : null}
      </View>

      {detail.exercises.length === 0 ? <Text tone="muted">{d.noSets}</Text> : null}
      {detail.exercises.map((e) => (
        <Card key={e.slug} style={{ gap: spacing.xs }}>
          <Text variant="heading">{e.name}</Text>
          {e.sets.map((s) => {
            const set = shown.find((x) => x.id === s.id)!;
            return (
              <ListItem
                key={s.id}
                title={d.set(s.number)}
                subtitle={d.setLine(s.weightKg, s.reps, s.rpe)}
                trailing={<Text variant="small" tone="accent">{d.edit}</Text>}
                onPress={() => open(set, d.editTitle(e.name, s.number))}
              />
            );
          })}
        </Card>
      ))}

      <Button label={d.deleteWorkout} variant="danger" onPress={() => setConfirm('workout')} />

      <BottomSheet visible={!!editing && confirm === null} onClose={() => setEditing(null)} title={editing?.title} closeLabel={en.common.close}>
        <TextField value={weight} onChangeText={setWeight} keyboardType="decimal-pad" accessibilityLabel={d.weight} placeholder={d.weight} style={{ minHeight: 52, textAlignVertical: 'center' }} />
        <TextField value={reps} onChangeText={setReps} keyboardType="number-pad" accessibilityLabel={d.reps} placeholder={d.reps} style={{ minHeight: 52, textAlignVertical: 'center' }} />
        <View style={{ gap: spacing.sm }}>
          <Text variant="small" tone="muted">{d.effort}</Text>
          <ChipGroup options={RPE_OPTIONS} value={rpe} onChange={setRpe} />
        </View>
        {errors.map((e) => <Text key={e} tone="danger" accessibilityRole="alert">{message[e]}</Text>)}
        <Button label={d.save} onPress={save} />
        <Button label={d.deleteSet} variant="danger" onPress={() => setConfirm('set')} />
        <Button label={en.common.cancel} variant="ghost" onPress={() => setEditing(null)} />
      </BottomSheet>

      <BottomSheet visible={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'workout' ? d.confirmWorkoutTitle : d.confirmSetTitle} closeLabel={en.common.close}>
        <Text tone="muted">{confirm === 'workout' ? d.confirmWorkoutBody : d.confirmSetBody}</Text>
        <Button label={confirm === 'workout' ? d.deleteWorkout : d.deleteSet} variant="danger" onPress={confirm === 'workout' ? removeWorkout : removeSet} />
        <Button label={d.keep} variant="secondary" onPress={() => setConfirm(null)} />
      </BottomSheet>
    </Screen>
  );
}
