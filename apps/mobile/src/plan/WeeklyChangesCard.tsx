import { useRouter } from 'expo-router';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Card, Text } from '../ui';
import { usePendingWeekly } from './weekly';

const t = en.home.weekly;

/** On Today when the weekly update made a new plan the user has not decided on yet. */
export function WeeklyChangesCard() {
  const pending = usePendingWeekly();
  const router = useRouter();
  const { spacing } = useTheme();
  if (!pending) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="heading">{t.cardTitle}</Text>
      <Text tone="muted">{t.cardBody}</Text>
      <Button label={t.cardCta} onPress={() => router.push('/weekly-changes')} />
    </Card>
  );
}
