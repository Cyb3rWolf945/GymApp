import { useRouter } from 'expo-router';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Card, Text } from '../ui';

/** Shown when the models could not make a plan and the starter template was used (E-64, E-66). The button goes to "Update my plan". */
export function StarterPlanNote() {
  const router = useRouter();
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text tone="muted">{en.plan.starterPlan}</Text>
      <Button label={en.plan.starterPlanCta} variant="secondary" onPress={() => router.push('/update-plan')} />
    </Card>
  );
}
