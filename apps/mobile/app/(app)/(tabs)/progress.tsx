import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  type MapView, type MuscleId, type MuscleSet, type SetRecord, type WeightPoint,
  e1rmTrend, muscleLabel, muscleStats, parseWeightKg, personalRecords, trendChange, trendLifts, weightTrend,
} from '@gymapp/shared';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/auth/AuthProvider';
import { en } from '../../../src/copy/en';
import { fetchSets, fetchWeights, logWeight } from '../../../src/progress/api';
import { MuscleMap } from '../../../src/progress/MuscleMap';
import { supabase } from '../../../src/supabase';
import { useTheme } from '../../../src/theme';
import { useWorkout } from '../../../src/workout/WorkoutProvider';
import { BottomSheet, Button, Card, Chip, EmptyState, LineChart, ListItem, ResponsiveGrid, Screen, Text, TextField, useToast } from '../../../src/ui';

const t = en.home;
const p = t.progress;
const h = en.workout.history;

interface Row {
  id: string;
  title: string;
  date: string;
  sets: number;
  volume: number;
}

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Progress: body weight, personal records, strength trend, a muscle map and the workout history. */
export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const { pending } = useWorkout();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [sets, setSets] = useState<{ records: SetRecord[]; muscleSets: MuscleSet[] }>({ records: [], muscleSets: [] });
  const [failed, setFailed] = useState(false);

  const [weightText, setWeightText] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [lift, setLift] = useState<string | null>(null);
  const [view, setView] = useState<MapView>('front');
  const [selected, setSelected] = useState<MuscleId | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [w, s, sessions] = await Promise.all([
        fetchWeights(user.id),
        fetchSets(user.id),
        supabase.from('workout_sessions').select('id,day_name,started_at').eq('user_id', user.id).not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(30),
      ]);
      const list = (sessions.data ?? []) as { id: string; day_name: string | null; started_at: string }[];
      const { data: logs } = list.length ? await supabase.from('set_logs').select('session_id,weight_kg,reps').eq('is_warmup', false).in('session_id', list.map((x) => x.id)) : { data: [] };
      const agg = new Map<string, { sets: number; volume: number }>();
      for (const l of (logs ?? []) as { session_id: string; weight_kg: number | null; reps: number | null }[]) {
        const a = agg.get(l.session_id) ?? { sets: 0, volume: 0 };
        a.sets += 1;
        a.volume += Number(l.weight_kg ?? 0) * Number(l.reps ?? 0);
        agg.set(l.session_id, a);
      }
      setWeights(w);
      setSets(s);
      setRows(
        list.map((x) => ({
          id: x.id,
          title: x.day_name ?? t.tabs.today,
          date: new Date(x.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          sets: agg.get(x.id)?.sets ?? 0,
          volume: Math.round(agg.get(x.id)?.volume ?? 0),
        })),
      );
      setFailed(false);
    } catch {
      setFailed(true);
      setRows((r) => r ?? []);
    }
  }, [user]);
  // Load when the screen opens, when you come back to it, and whenever the queue of writes empties (a correction made in a past workout was saved), so records and charts recalculate.
  useFocusEffect(useCallback(() => void load(), [load]));
  useEffect(() => {
    if (pending === 0) void load();
  }, [pending, load]);

  const trend = useMemo(() => weightTrend(weights), [weights]);
  const change = trendChange(trend);
  const prs = useMemo(() => personalRecords(sets.records), [sets.records]);
  const lifts = useMemo(() => trendLifts(sets.records), [sets.records]);
  const activeLift = lift ?? lifts[0]?.slug ?? null;
  const liftTrend = useMemo(() => (activeLift ? e1rmTrend(sets.records, activeLift) : []), [sets.records, activeLift]);
  const liftName = lifts.find((l) => l.slug === activeLift)?.name ?? '';
  const stats = useMemo(() => muscleStats(sets.muscleSets), [sets.muscleSets]);
  const trained = [...stats.values()].filter((s) => s.sets > 0).sort((a, b) => b.sets - a.sets);
  const detail = selected ? stats.get(selected) : null;

  const saveWeight = async () => {
    const kg = parseWeightKg(weightText);
    if (kg === null) return setWeightError(p.weightInvalid);
    if (!user) return;
    setSaving(true);
    setWeightError(null);
    const ok = await logWeight(user.id, kg);
    setSaving(false);
    if (!ok) return setWeightError(p.weightSaveError);
    setWeightText('');
    toast.show(p.weightSaved, 'success');
    void load();
  };

  const empty = rows !== null && rows.length === 0 && weights.length === 0 && sets.records.length === 0 && !failed;

  return (
    <Screen variant="dashboard" style={{ flexGrow: 1 }}>
        <Text variant="display">{t.progressTitle}</Text>
        {rows === null ? <ActivityIndicator color={colors.accent} /> : null}
        {failed ? <Text tone="danger" accessibilityRole="alert">{p.loadError}</Text> : null}

        <ResponsiveGrid gap={spacing.xl} columns={{ expanded: 2 }}>
        {rows !== null ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{p.weightTitle}</Text>
            {trend.length === 0 ? (
              <Text tone="muted">{p.weightEmpty}</Text>
            ) : (
              <>
                <Text tone="muted">{p.weightNow(trend[trend.length - 1].avg)}</Text>
                {change !== null ? <Text variant="small" tone="muted">{p.weightChange(change)}</Text> : null}
                <LineChart values={trend.map((x) => x.avg)} dots={trend.map((x) => x.kg)} label={p.weightChart(trend.length)} />
              </>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <TextField
                value={weightText}
                onChangeText={setWeightText}
                placeholder={p.weightPlaceholder}
                keyboardType="decimal-pad"
                accessibilityLabel={p.weightPlaceholder}
                style={{ flex: 1, minHeight: 48, minWidth: 0 }}
              />
              <View style={{ flexShrink: 0 }}>
                <Button label={p.logWeight} loading={saving} onPress={() => void saveWeight()} />
              </View>
            </View>
            {weightError ? <Text tone="danger" accessibilityRole="alert">{weightError}</Text> : null}
          </Card>
        ) : null}

        {rows !== null ? (
          <Card style={{ gap: spacing.xs }}>
            <Text variant="heading">{p.prsTitle}</Text>
            {prs.length === 0 ? (
              <Text tone="muted">{p.prsEmpty}</Text>
            ) : (
              <>
                {prs.slice(0, 8).map((r) => (
                  <ListItem key={r.slug} title={r.name} subtitle={p.prLine(r.weightKg, r.reps, shortDate(r.date))} trailing={<Text variant="bodyStrong">{p.prValue(r.e1rm)}</Text>} onPress={() => router.push({ pathname: '/exercise/[slug]', params: { slug: r.slug } })} />
                ))}
                <Text variant="small" tone="muted">{p.prNote}</Text>
              </>
            )}
          </Card>
        ) : null}

        {rows !== null ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{p.trendTitle}</Text>
            {lifts.length === 0 ? (
              <Text tone="muted">{p.trendEmpty}</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {lifts.map((l) => (
                    <Chip key={l.slug} label={l.name} selected={l.slug === activeLift} onPress={() => setLift(l.slug)} />
                  ))}
                </View>
                {liftTrend.length > 0 ? (
                  <>
                    <Text tone="muted">{p.trendNow(liftTrend[liftTrend.length - 1].e1rm)}</Text>
                    <LineChart values={liftTrend.map((x) => x.e1rm)} label={p.trendChart(liftName, liftTrend.length)} />
                  </>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {rows !== null ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{p.mapTitle}</Text>
            <Text tone="muted">{p.mapBody}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip label={p.front} selected={view === 'front'} onPress={() => setView('front')} />
              <Chip label={p.back} selected={view === 'back'} onPress={() => setView('back')} />
            </View>
            <MuscleMap view={view} stats={stats} onSelect={setSelected} />
            <Text variant="bodyStrong">{p.mapListTitle}</Text>
            {trained.length === 0 ? (
              <Text tone="muted">{p.noSets}</Text>
            ) : (
              trained.map((s) => <ListItem key={s.muscle} title={muscleLabel(s.muscle)} subtitle={p.sets(s.sets)} onPress={() => setSelected(s.muscle)} />)
            )}
          </Card>
        ) : null}
        </ResponsiveGrid>

        {empty ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState title={t.progressEmptyTitle} body={t.progressEmptyBody} />
          </View>
        ) : null}

        {rows && rows.length > 0 ? (
          <Card style={{ gap: spacing.xs }}>
            <Text variant="heading">{h.title}</Text>
            {rows.map((r) => (
              <ListItem key={r.id} title={`${r.date} · ${r.title}`} subtitle={h.sessionLine(r.sets, r.volume)} onPress={() => router.push(`/history/${r.id}`)} />
            ))}
          </Card>
        ) : null}
      <BottomSheet visible={!!detail} onClose={() => setSelected(null)} title={selected ? muscleLabel(selected) : undefined} closeLabel={en.common.close}>
        {detail ? (
          <>
            <Text>{`${p.sheetWeekly}: ${detail.sets > 0 ? p.sets(detail.sets) : p.noSets}`}</Text>
            <Text>{`${p.sheetLast}: ${detail.lastTrained ? shortDate(detail.lastTrained) : p.sheetNever}`}</Text>
            <Text variant="bodyStrong">{p.sheetTop}</Text>
            {detail.topExercises.length === 0 ? <Text tone="muted">{p.sheetNoExercises}</Text> : null}
            {detail.topExercises.map((e) => (
              <ListItem key={e.slug} title={e.name} subtitle={p.sets(e.sets)} />
            ))}
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
