import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { fetchPaywall, openPortal } from '../plan/api';
import { useTheme } from '../theme';
import { Button, Card, Text } from '../ui';

const t = en.paywall;

/** Shown while the subscription is past due. The button opens the Stripe Customer Portal. */
export function PastDueBanner() {
  const { user } = useAuth();
  const { spacing } = useTheme();
  const [pastDue, setPastDue] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user) return;
    void fetchPaywall(user.id).then((d) => setPastDue(d.pastDue), () => setPastDue(false));
  }, [user]);
  if (!pastDue) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="heading" accessibilityRole="alert">{t.pastDueTitle}</Text>
      <Text tone="muted">{t.pastDueBody}</Text>
      {error ? <Text tone="danger">{t.checkoutError}</Text> : null}
      <Button
        label={t.pastDueCta}
        onPress={async () => {
          const url = await openPortal();
          if (url) void Linking.openURL(url);
          else setError(true);
        }}
      />
    </Card>
  );
}
