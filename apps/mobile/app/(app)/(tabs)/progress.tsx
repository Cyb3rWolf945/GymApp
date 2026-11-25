import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/auth/AuthProvider';
import { en } from '../../../src/copy/en';
import { supabase } from '../../../src/supabase';
import { useTheme } from '../../../src/theme';
import { Card, EmptyState, ListItem, Text } from '../../../src/ui';

const t = en.home;
const h = en.workout.history;

interface Row {
  id: string;
  title: string;
  date: string;
  sets: number;
  volume: number;
}

/** Workout history (newest first). Charts come later. */
export default function ProgressScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let on = true;
    void (async () => {
      try {
        const { data: sessions } = await supabase
          .from('workout_sessions')
          .select('id,day_name,started_at')
          .eq('user_id', user.id)
          .not('finished_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(30);
        const list = (sessions ?? []) as { id: string; day_name: string | null; started_at: string }[];
        const { data: sets } = list.length
          ? await supabase.from('set_logs').select('session_id,weight_kg,reps').in('session_id', list.map((s) => s.id))
          : { data: [] };
        const agg = new Map<string, { sets: number; volume: number }>();
        for (const s of (sets ?? []) as { session_id: string; weight_kg: number | null; reps: number | null }[]) {
          const a = agg.get(s.session_id) ?? { sets: 0, volume: 0 };
          a.sets += 1;
          a.volume += Number(s.weight_kg ?? 0) * Number(s.reps ?? 0);
          agg.set(s.session_id, a);
        }
        if (on) {
          setRows(
            list.map((s) => ({
              id: s.id,
              title: s.day_name ?? en.home.tabs.today,
              date: new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              sets: agg.get(s.id)?.sets ?? 0,
              volume: Math.round(agg.get(s.id)?.volume ?? 0),
            })),
          );
        }
      } catch {
        if (on) setRows([]);
      }
    })();
    return () => {
      on = false;
    };
  }, [user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, flexGrow: 1 }}>
        <Text variant="display">{t.progressTitle}</Text>
        {rows === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : rows.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState title={t.progressEmptyTitle} body={t.progressEmptyBody} />
          </View>
        ) : (
          <Card style={{ gap: spacing.xs }}>
            <Text variant="heading">{h.title}</Text>
            {rows.map((r) => (
              <ListItem key={r.id} title={`${r.date} · ${r.title}`} subtitle={h.sessionLine(r.sets, r.volume)} />
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
