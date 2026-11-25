import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { isCheckinDue, trainingWeekdays, weekStartKey, type Weekday } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Card, Text } from '../ui';
import { dismissCheckin, dismissedWeek, lastCheckinWeek, onCheckinChanged } from './api';

const t = en.home.checkin;

/** Once a week, from the first workout day (or Monday): "Weekly check-in". Gone once sent or dismissed for the week. */
export function WeeklyCheckinCard({ workoutDays, preferredDays }: { workoutDays: number; preferredDays: readonly Weekday[] }) {
  const { user } = useAuth();
  const router = useRouter();
  const { spacing } = useTheme();
  const now = useMemo(() => new Date(), []);
  const week = weekStartKey(now);
  const [state, setState] = useState<{ sent: string | null; dismissed: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const read = () =>
      void Promise.all([lastCheckinWeek(user.id).catch(() => null), dismissedWeek(user.id)]).then(([sent, dismissed]) => active && setState({ sent, dismissed }));
    read();
    const off = onCheckinChanged(read);
    return () => {
      active = false;
      off();
    };
  }, [user]);

  if (!user || !state) return null;
  const trainingDays = trainingWeekdays(workoutDays, preferredDays);
  const due = isCheckinDue({ today: now, trainingDays, lastCheckinWeek: state.sent, dismissedWeek: state.dismissed });
  if (!due) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="heading">{t.cardTitle}</Text>
      <Text tone="muted">{t.cardBody}</Text>
      <View style={{ gap: spacing.sm }}>
        <Button label={t.cardCta} onPress={() => router.push({ pathname: '/checkin', params: { planned: String(trainingDays.length) } })} />
        <Button label={t.cardDismiss} variant="ghost" onPress={() => void dismissCheckin(user.id, week)} />
      </View>
    </Card>
  );
}
