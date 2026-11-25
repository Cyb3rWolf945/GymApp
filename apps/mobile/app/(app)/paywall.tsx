import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FOUNDING_COUPON, PAID_TIERS, type PaidTier, TRIAL_DAYS, annualSavingsPercent, formatUsd, perDayUsd } from '@gymapp/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { trackEvent } from '../../src/analytics/track';
import { en } from '../../src/copy/en';
import { type PaywallData, fetchPaywall, startCheckout } from '../../src/plan/api';
import { useBreakpoint, useTheme } from '../../src/theme';
import { Button, Card, EmptyState, ResponsiveGrid, Screen, Text } from '../../src/ui';

const t = en.paywall;

/** Screen 16. Prices come from `plan_prices` (with the user's A/B variant); Stripe Checkout runs on web only. */
export default function Paywall() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, radius, spacing } = useTheme();
  // Three narrow cards side by side on tablets: a smaller price keeps "/year" on one line.
  const priceVariant = useBreakpoint() === 'medium' ? 'heading' : 'display';
  const [data, setData] = useState<PaywallData | null>(null);
  const [failed, setFailed] = useState(false);
  const [interval, setIntervalChoice] = useState<'month' | 'year'>('year');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const web = Platform.OS === 'web';

  useEffect(() => {
    if (!user) return;
    void fetchPaywall(user.id).then((d) => {
      setData(d);
      trackEvent('paywall_view', { variant: d.variant });
    }, () => setFailed(true));
  }, [user]);

  const price = useMemo(() => {
    const byKey = new Map(data?.prices.map((p) => [p.lookup_key, p]) ?? []);
    return (tier: PaidTier, i: 'month' | 'year') => byKey.get(`${tier}_${i === 'month' ? 'monthly' : 'annual'}`);
  }, [data]);

  const subscribe = async (tier: PaidTier) => {
    const key = price(tier, interval)?.lookup_key;
    if (!key) return;
    setBusy(tier);
    setError(null);
    trackEvent('checkout_start', { price_key: key, variant: data?.variant });
    // The founding offer only applies to Pro annual; the server enforces that too.
    const url = await startCheckout(key, key === FOUNDING_COUPON.lookupKey);
    setBusy(null);
    if (!url) return setError(t.checkoutError);
    await Linking.openURL(url);
  };

  const body = () => {
    if (failed || (data && data.prices.length === 0)) return <EmptyState title={t.loadError} actionLabel={en.common.retry} onAction={() => router.replace('/paywall')} />;
    if (!data) return <ActivityIndicator color={colors.accent} />;
    return (
      <>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label={t.monthly} variant={interval === 'month' ? 'primary' : 'secondary'} onPress={() => setIntervalChoice('month')} />
          <Button label={t.annual} variant={interval === 'year' ? 'primary' : 'secondary'} onPress={() => setIntervalChoice('year')} />
        </View>
        {/* Tiers side by side from `medium`, stacked on phones. */}
        <ResponsiveGrid gap={spacing.lg} columns={{ medium: 3, expanded: 3 }}>
        {PAID_TIERS.map((tier) => {
          const p = price(tier, interval);
          const monthly = price(tier, 'month');
          if (!p) return null;
          const savings = interval === 'year' && monthly ? annualSavingsPercent(monthly.cents, p.cents) : 0;
          return (
            <Card key={tier} style={{ gap: spacing.sm, borderWidth: tier === 'pro' ? 2 : 0, borderColor: colors.accent, borderRadius: radius.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="heading">{t.plans[tier].name}</Text>
                {tier === 'pro' ? <Text variant="small" tone="accent">{t.popular}</Text> : null}
              </View>
              <Text variant={priceVariant}>{interval === 'month' ? t.perMonth(formatUsd(p.cents)) : t.perYear(formatUsd(p.cents))}</Text>
              <Text tone="muted">{t.perDay(perDayUsd(p.cents, interval))}{savings > 0 ? ` · ${t.savings(savings)}` : ''}</Text>
              {tier === 'elite' ? <Text tone="accent">{t.eliteHighlight}</Text> : null}
              {t.plans[tier].features.map((f) => (
                <Text key={f}>{`• ${f}`}</Text>
              ))}
              {interval === 'year' ? <Text variant="small" tone="muted">{t.trial(TRIAL_DAYS)}</Text> : null}
              {web ? (
                <Button label={interval === 'year' ? t.cta : t.subscribe} variant={tier === 'pro' ? 'primary' : 'secondary'} loading={busy === tier} onPress={() => void subscribe(tier)} />
              ) : null}
            </Card>
          );
        })}
        </ResponsiveGrid>
        {!web ? <Text tone="muted">{t.webOnly}</Text> : null}
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      </>
    );
  };

  return (
    <Screen variant="dashboard" style={{ gap: spacing.lg }}>
      <Text variant="display">{t.title}</Text>
      <Text tone="muted">{t.body}</Text>
      {body()}
      <Button label={en.common.continue} variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
