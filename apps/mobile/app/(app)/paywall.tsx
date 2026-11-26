import { useRouter } from 'expo-router';
import { PlanComparison } from '../../src/billing/PlanComparison';
import { usePlanPicker } from '../../src/billing/PlanPicker';
import { en } from '../../src/copy/en';
import { useTheme } from '../../src/theme';
import { Button, Screen, Text } from '../../src/ui';

const t = en.paywall;

/** Screen 16. Prices come from `plan_prices` (with the user's A/B variant); Stripe Checkout runs on web only. Same pattern as the account modal: pick a card, then one button for it. */
export default function Paywall() {
  const router = useRouter();
  const { spacing } = useTheme();
  const picker = usePlanPicker({ placement: 'paywall', secondary: <Button label={en.common.continue} variant="secondary" onPress={() => router.replace('/')} /> });
  return (
    <Screen variant="dashboard" style={{ gap: spacing.lg }} footer={picker.footer}>
      <Text variant="display">{t.title}</Text>
      <Text tone="muted">{t.body}</Text>
      {picker.body}
      <PlanComparison />
    </Screen>
  );
}
