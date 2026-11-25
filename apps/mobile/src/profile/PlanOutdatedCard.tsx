import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Card, Text } from '../ui';
import { usePlanOutdated } from './outdated';

const t = en.home.profile;

/** On Today and Plan after a profile change: "Your profile changed. Update your plan to match." Nothing runs until the button is pressed. */
export function PlanOutdatedCard() {
  const { user } = useAuth();
  const router = useRouter();
  const { spacing } = useTheme();
  if (!usePlanOutdated(user?.id)) return null;
  return (
    <Card style={{ gap: spacing.sm }} accessibilityRole="alert">
      <Text>{t.outdatedBody}</Text>
      <Button label={t.outdatedCta} onPress={() => router.push('/update-plan')} />
    </Card>
  );
}
