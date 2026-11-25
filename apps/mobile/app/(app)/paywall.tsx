import { useRouter } from 'expo-router';
import { PlanPicker } from '../../src/billing/PlanPicker';
import { en } from '../../src/copy/en';
import { useTheme } from '../../src/theme';
import { Button, Screen, Text } from '../../src/ui';

const t = en.paywall;

/** Screen 16. Prices come from `plan_prices` (with the user's A/B variant); Stripe Checkout runs on web only. */
export default function Paywall() {
  const router = useRouter();
  const { spacing } = useTheme();
  return (
    <Screen variant="dashboard" style={{ gap: spacing.lg }}>
      <Text variant="display">{t.title}</Text>
      <Text tone="muted">{t.body}</Text>
      <PlanPicker placement="paywall" mode="buttons" />
      <Button label={en.common.continue} variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
