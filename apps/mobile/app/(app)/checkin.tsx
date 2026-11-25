import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CHECKIN_LIMITS, weekStartKey } from '@gymapp/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { lastWeight, notifyCheckinChanged, sendCheckin, workoutsThisWeek } from '../../src/checkin/api';
import { en } from '../../src/copy/en';
import { useTheme } from '../../src/theme';
import { Button, ChipGroup, Screen, Text, TextField, useToast } from '../../src/ui';

const t = en.home.checkin;
const SCALE = t.scale.map((label) => ({ value: label, label }));
const toNumber = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

/** Weekly check-in: under 30 seconds. Weight and workouts start from what the app already knows. */
export default function CheckinScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ planned?: string }>();
  const planned = Math.max(0, Math.min(14, Number(params.planned) || 0));
  const week = useMemo(() => weekStartKey(new Date()), []);
  const [weight, setWeight] = useState('');
  const [energy, setEnergy] = useState<string[]>([]);
  const [sleep, setSleep] = useState<string[]>([]);
  const [done, setDone] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'weight' | 'energy' | 'sleep' | 'workouts', string>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.all([lastWeight(user.id), workoutsThisWeek(user.id, week)]).then(([kg, n]) => {
      if (!active) return;
      setWeight((cur) => cur || (kg === null ? '' : String(kg)));
      setDone((cur) => cur || String(n));
    });
    return () => {
      active = false;
    };
  }, [user, week]);

  const save = async () => {
    const kg = toNumber(weight);
    const n = toNumber(done);
    const next: typeof errors = {};
    if (weight.trim() !== '' && !(kg > CHECKIN_LIMITS.weightKg.min && kg < CHECKIN_LIMITS.weightKg.max)) next.weight = t.errors.weight;
    if (!energy[0]) next.energy = t.errors.energy;
    if (!sleep[0]) next.sleep = t.errors.sleep;
    if (!(Number.isInteger(n) && n >= CHECKIN_LIMITS.workouts.min && n <= CHECKIN_LIMITS.workouts.max)) next.workouts = t.errors.workouts;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setFailed(false);
    const ok = await sendCheckin({
      weekStart: week,
      weightKg: weight.trim() === '' ? undefined : kg,
      energy: Number(energy[0]),
      sleep: Number(sleep[0]),
      workoutsDone: n,
      workoutsPlanned: planned,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!ok) return setFailed(true);
    notifyCheckinChanged();
    toast.show(t.saved, 'success');
    router.back();
  };

  return (
    <Screen keyboardTaps footer={<Button label={t.save} loading={busy} onPress={() => void save()} />}>
      <Text variant="display">{t.title}</Text>
      <Text tone="muted">{t.intro}</Text>

      <View style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">{t.weight}</Text>
        <TextField value={weight} onChangeText={setWeight} keyboardType="decimal-pad" accessibilityLabel={t.weight} />
        <Text variant="small" tone="muted">{t.weightHint}</Text>
        {errors.weight ? <Text tone="danger" accessibilityRole="alert">{errors.weight}</Text> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">{t.energy}</Text>
        <ChipGroup options={SCALE} value={energy} onChange={setEnergy} />
        {errors.energy ? <Text tone="danger" accessibilityRole="alert">{errors.energy}</Text> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">{t.sleep}</Text>
        <ChipGroup options={SCALE} value={sleep} onChange={setSleep} />
        <Text variant="small" tone="muted">{t.scaleHint}</Text>
        {errors.sleep ? <Text tone="danger" accessibilityRole="alert">{errors.sleep}</Text> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">{t.workouts(planned)}</Text>
        <TextField value={done} onChangeText={setDone} keyboardType="number-pad" accessibilityLabel={t.workouts(planned)} />
        {errors.workouts ? <Text tone="danger" accessibilityRole="alert">{errors.workouts}</Text> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="bodyStrong">{t.note}</Text>
        <TextField multiline maxLength={CHECKIN_LIMITS.note} value={note} placeholder={t.notePlaceholder} accessibilityLabel={t.note} onChangeText={setNote} />
      </View>
      {failed ? <Text tone="danger" accessibilityRole="alert">{t.error}</Text> : null}
    </Screen>
  );
}
