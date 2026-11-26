import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { FOUNDING_COUPON, PAID_TIERS, type PaidTier, TRIAL_DAYS, annualSavingsPercent, formatUsd, perDayUsd } from '@gymapp/shared';
import { trackEvent } from '../analytics/track';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { type PaywallData, fetchPaywall, startCheckout } from '../plan/api';
import { useBreakpoint, useTheme } from '../theme';
import { Button, Card, EmptyState, ResponsiveGrid, ScreenSkeleton, Text } from '../ui';

const t = en.paywall;

export interface PlanSelection {
  tier: PaidTier;
  interval: 'month' | 'year';
}
/** Pro is pre-selected and Annual is the default. */
export const DEFAULT_SELECTION: PlanSelection = { tier: 'pro', interval: 'year' };

interface Options {
  /** Where the plans are shown, for analytics and for where Stripe sends a cancelled checkout back to. */
  placement: 'paywall' | 'account_modal';
  /** `buttons`: a button on every card (the paywall page). `select`: pick a card, one button for it (the account modal). */
  mode: 'buttons' | 'select';
  /** The starting choice in `select` mode (restored after Stripe sends someone back). */
  initial?: PlanSelection;
  /** Called with the choice just before leaving for Stripe, so the caller can remember it. */
  onCheckoutStart?: (selection: PlanSelection) => void;
  /** `select` mode: what goes under the main button, such as "See my plan first". */
  secondary?: ReactNode;
}

/**
 * The plans: Monthly / Annual toggle, a card per tier, and Stripe Checkout (web). One implementation for the paywall
 * page and step 2 of the account modal. Returns the scrolling `body` and a `footer` (the pinned button and small
 * print in `select` mode; nothing in `buttons` mode).
 */
export function usePlanPicker({ placement, mode, initial = DEFAULT_SELECTION, onCheckoutStart, secondary }: Options): { body: ReactNode; footer: ReactNode } {
  const { user } = useAuth();
  const { colors, radius, spacing } = useTheme();
  // Three narrow cards side by side on tablets: a smaller price keeps "/year" on one line.
  const priceVariant = useBreakpoint() === 'medium' ? 'heading' : 'display';
  const [data, setData] = useState<PaywallData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<PlanSelection>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const web = Platform.OS === 'web';
  const { interval } = selection;
  const select = mode === 'select';

  useEffect(() => {
    if (!user) return;
    let active = true;
    setFailed(false);
    void fetchPaywall(user.id).then(
      (d) => {
        if (!active) return;
        setData(d);
        trackEvent('paywall_view', { variant: d.variant, placement });
      },
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [user, placement, attempt]);

  const price = useMemo(() => {
    const byKey = new Map(data?.prices.map((p) => [p.lookup_key, p]) ?? []);
    return (tier: PaidTier, i: 'month' | 'year') => byKey.get(`${tier}_${i === 'month' ? 'monthly' : 'annual'}`);
  }, [data]);

  const subscribe = async (tier: PaidTier) => {
    const key = price(tier, interval)?.lookup_key;
    if (!key) return;
    setBusy(tier);
    setError(null);
    trackEvent('checkout_start', { price_key: key, variant: data?.variant, placement });
    onCheckoutStart?.({ tier, interval });
    // The founding offer only applies to Pro annual; the server enforces that too.
    const url = await startCheckout(key, key === FOUNDING_COUPON.lookupKey, placement === 'account_modal' ? 'account_modal' : undefined);
    setBusy(null);
    if (!url) return setError(t.checkoutError);
    await Linking.openURL(url);
  };

  if (failed || (data && data.prices.length === 0)) {
    return { body: <EmptyState title={t.loadError} actionLabel={en.common.retry} onAction={() => setAttempt((n) => n + 1)} />, footer: null };
  }
  if (!data) return { body: <ScreenSkeleton title={false} cards={2} label={en.common.loading} />, footer: null };

  const setInterval = (i: 'month' | 'year') => setSelection((s) => ({ ...s, interval: i }));
  const chosen = price(selection.tier, interval);

  const body = (
    <>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={t.monthly} variant={interval === 'month' ? 'primary' : 'secondary'} accessibilityState={{ selected: interval === 'month' }} aria-pressed={interval === 'month'} onPress={() => setInterval('month')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t.annual} variant={interval === 'year' ? 'primary' : 'secondary'} accessibilityState={{ selected: interval === 'year' }} aria-pressed={interval === 'year'} onPress={() => setInterval('year')} />
        </View>
      </View>
      {/* Tiers side by side from `medium`, stacked on phones. */}
      <ResponsiveGrid gap={spacing.lg} columns={{ medium: 3, expanded: 3 }}>
        {PAID_TIERS.map((tier) => {
          const p = price(tier, interval);
          const monthly = price(tier, 'month');
          if (!p) return null;
          const savings = interval === 'year' && monthly ? annualSavingsPercent(monthly.cents, p.cents) : 0;
          const isChosen = select && selection.tier === tier;
          const card = (
            <Card key={tier} style={{ gap: spacing.sm, borderWidth: tier === 'pro' || isChosen ? 2 : 0, borderColor: isChosen || tier === 'pro' ? colors.accent : undefined, borderRadius: radius.lg }}>
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
              {!select && web ? (
                <Button label={interval === 'year' ? t.cta : t.subscribe} variant={tier === 'pro' ? 'primary' : 'secondary'} loading={busy === tier} onPress={() => void subscribe(tier)} />
              ) : null}
            </Card>
          );
          // Select mode: the whole card is one choice (a radio), announced with its tier and interval.
          return select ? (
            <Pressable
              key={tier}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen }}
              aria-checked={isChosen}
              accessibilityLabel={t.chosen(t.plans[tier].name, interval === 'month' ? t.monthly : t.annual)}
              onPress={() => setSelection((s) => ({ ...s, tier }))}
            >
              {card}
            </Pressable>
          ) : (
            card
          );
        })}
      </ResponsiveGrid>
      {!web ? <Text tone="muted">{t.webOnly}</Text> : null}
      {!select && error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </>
  );

  if (!select) return { body, footer: null };

  const openLegal = (doc: 'terms' | 'privacy') => void Linking.openURL(`${window.location.origin}/legal/${doc}`);
  const footer = (
    <>
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      {web ? (
        <Button label={interval === 'year' ? t.ctaTrial(TRIAL_DAYS) : t.subscribe} loading={busy === selection.tier} disabled={!chosen} onPress={() => void subscribe(selection.tier)} />
      ) : null}
      {secondary}
      {web && chosen ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="small" tone="muted">{interval === 'year' ? t.afterTrial(formatUsd(chosen.cents)) : t.cancelAnytime}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Pressable accessibilityRole="link" onPress={() => openLegal('terms')}><Text variant="small" tone="accent">{t.terms}</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => openLegal('privacy')}><Text variant="small" tone="accent">{t.privacy}</Text></Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
  return { body, footer };
}

/** The picker on a page: body then footer in one column. */
export function PlanPicker(props: Options) {
  const { body, footer } = usePlanPicker(props);
  return (
    <>
      {body}
      {footer}
    </>
  );
}
