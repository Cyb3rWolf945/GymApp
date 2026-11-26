import { useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { type PartialAnswers, profileRows } from '@gymapp/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { en } from '../../src/copy/en';
import { fetchProfileAnswers } from '../../src/profile/api';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, ListItem, Screen, ScreenSkeleton, Text } from '../../src/ui';

const t = en.home.profile;

/** "Your profile": one row per onboarding question; each opens the same step screen the quiz uses. */
export default function Profile() {
  const { user } = useAuth();
  const router = useRouter();
  const { spacing } = useTheme();
  const [answers, setAnswers] = useState<PartialAnswers | null | undefined>(undefined); // undefined = loading, null = failed

  const load = useCallback(() => {
    if (!user) return;
    void fetchProfileAnswers(user.id).then(setAnswers);
  }, [user]);
  useFocusEffect(load);
  useEffect(load, [load]);

  return (
    <Screen footer={<Button label={en.common.back} variant="ghost" onPress={() => router.back()} />}>
      <Text variant="display" accessibilityRole="header">{t.title}</Text>
      <Text tone="muted">{t.intro}</Text>
      {answers === undefined ? <ScreenSkeleton title={false} cards={3} label={en.common.loading} /> : null}
      {answers === null ? <EmptyState kind="error" title={t.loadError} actionLabel={t.retry} onAction={load} /> : null}
      {answers ? (
        <Card style={{ gap: spacing.xs }}>
          {profileRows(answers).map((id) => (
            <ListItem key={id} title={t.rows[id]} trailing={<Text tone="muted">›</Text>} onPress={() => router.push(`/profile/${id}`)} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
