import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Platform, Pressable, View } from 'react-native';
import {
  DEFAULT_SELECTION, FOUNDING_COUPON, PAID_TIERS, type PaidTier, type PlanInterval, type PlanSelection, TRIAL_DAYS, annualSavingsPercent, formatUsd, isSelected,
  moveSelection, perDayUsd, selectInterval, selectTier,
} from '@gymapp/shared';
import { trackEvent } from '../analytics/track';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { type PaywallData, fetchPaywall, startCheckout } from '../plan/api';
import { FadeSlideIn, durationFor, easing, useHaptics, usePressSpring, useReducedMotion } from '../motion';
import { mixColors, useBreakpoint, useTheme } from '../theme';
import { Button, EmptyState, Icon, ResponsiveGrid, ScreenSkeleton, Text } from '../ui';

const t = en.paywall;

export { DEFAULT_SELECTION, type PlanSelection };

interface Options {
  /** Where the plans are shown, for analytics and for where Stripe sends a cancelled checkout back to. */
  placement: 'paywall' | 'account_modal';
  /** The starting choice (restored after Stripe sends someone back). */
  initial?: PlanSelection;
  /** Called with the choice just before leaving for Stripe, so the caller can remember it. */
  onCheckoutStart?: (selection: PlanSelection) => void;
  /** What goes under the main button, such as "See my plan first". */
  secondary?: ReactNode;
}

/**
 * The plans: Monthly / Annual toggle, a card per tier, and Stripe Checkout (web). One implementation for the paywall
 * page and step 2 of the account modal. Returns the scrolling `body` and a `footer` (the pinned button and small
 * print in `select` mode; nothing in `buttons` mode).
 */
export function usePlanPicker({ placement, initial = DEFAULT_SELECTION, onCheckoutStart, secondary }: Options): { body: ReactNode; footer: ReactNode } {
  const { user } = useAuth();
  const { spacing } = useTheme();
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
  const cards = useRef<Partial<Record<PaidTier, { focus?: () => void } | null>>>({});
  const haptic = useHaptics();

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
    return { body: <EmptyState kind="error" title={t.loadError} actionLabel={en.common.retry} onAction={() => setAttempt((n) => n + 1)} />, footer: null };
  }
  if (!data) return { body: <ScreenSkeleton title={false} cards={2} label={en.common.loading} />, footer: null };

  const chosen = price(selection.tier, interval);
  const choose = (tier: PaidTier) => {
    if (tier === selection.tier) return;
    haptic();
    setSelection((s) => selectTier(s, tier));
  };
  // Arrow keys move the selection (and the focus) through the cards.
  const onKey = (e: { key: string; preventDefault: () => void }) => {
    const next = moveSelection(selection, e.key);
    if (next.tier === selection.tier) return;
    e.preventDefault();
    haptic();
    setSelection(next);
    cards.current[next.tier]?.focus?.();
  };

  const body = (
    <>
      <IntervalToggle interval={interval} onChange={(i) => setSelection((s) => selectInterval(s, i))} />
      {/* The cards are one single-choice group. Tiers side by side from `medium`, stacked on phones. */}
      <View accessibilityRole="radiogroup" accessibilityLabel={t.title}>
        <ResponsiveGrid gap={spacing.lg} columns={{ medium: 3, expanded: 3 }}>
          {PAID_TIERS.map((tier) => {
            const p = price(tier, interval);
            const monthly = price(tier, 'month');
            if (!p) return null;
            const savings = interval === 'year' && monthly ? annualSavingsPercent(monthly.cents, p.cents) : 0;
            return (
              <PlanCard
                key={tier}
                selected={isSelected(selection, tier)}
                label={t.chosen(t.plans[tier].name, interval === 'month' ? t.monthly : t.annual)}
                onSelect={() => choose(tier)}
                onKey={web ? onKey : undefined}
                cardRef={(node) => {
                  cards.current[tier] = node;
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="heading">{t.plans[tier].name}</Text>
                  {/* A label, not a selection: it stays on Pro whatever is selected. */}
                  {tier === 'pro' ? <Text variant="small" tone="accent">{t.popular}</Text> : null}
                </View>
                <FadeSlideIn key={`price-${interval}`}>
                  <Text variant={priceVariant}>{interval === 'month' ? t.perMonth(formatUsd(p.cents)) : t.perYear(formatUsd(p.cents))}</Text>
                  <Text tone="muted">{t.perDay(perDayUsd(p.cents, interval))}{savings > 0 ? ` · ${t.savings(savings)}` : ''}</Text>
                </FadeSlideIn>
                {tier === 'elite' ? <Text tone="accent">{t.eliteHighlight}</Text> : null}
                {t.plans[tier].features.map((f) => (
                  <Text key={f}>{`• ${f}`}</Text>
                ))}
                {interval === 'year' ? <FadeSlideIn key="trial"><Text variant="small" tone="muted">{t.trial(TRIAL_DAYS)}</Text></FadeSlideIn> : null}
              </PlanCard>
            );
          })}
        </ResponsiveGrid>
      </View>
      {!web ? <Text tone="muted">{t.webOnly}</Text> : null}
    </>
  );

  const openLegal = (doc: 'terms' | 'privacy') => void Linking.openURL(`${window.location.origin}/legal/${doc}`);
  // One primary button for the selected plan; its label and the price line under it cross-fade when the plan or interval changes.
  const footer = (
    <>
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      {web ? (
        <FadeSlideIn key={`cta-${selection.tier}-${interval}`}>
          <Button label={interval === 'year' ? t.ctaTrial(TRIAL_DAYS) : t.subscribe} loading={busy === selection.tier} disabled={!chosen} onPress={() => void subscribe(selection.tier)} />
        </FadeSlideIn>
      ) : null}
      {secondary}
      {web && chosen ? (
        <View style={{ gap: spacing.xs }}>
          <FadeSlideIn key={`fine-${selection.tier}-${interval}`}>
            <Text variant="small" tone="muted">{interval === 'year' ? t.afterTrial(formatUsd(chosen.cents)) : t.cancelAnytime}</Text>
          </FadeSlideIn>
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

/** Monthly / Annual with a highlight that slides from one to the other (instant with reduced motion). */
function IntervalToggle({ interval, onChange }: { interval: PlanInterval; onChange: (i: PlanInterval) => void }) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(interval === 'year' ? 1 : 0)).current;
  useEffect(() => {
    const to = interval === 'year' ? 1 : 0;
    if (reduced) x.setValue(to);
    else Animated.timing(x, { toValue: to, duration: durationFor('base', false), easing: easing('standard'), useNativeDriver: true }).start();
  }, [interval, reduced, x]);
  const half = Math.max(0, (width - 8) / 2);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, half] });
  const option = (value: PlanInterval, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: interval === value }}
      aria-pressed={interval === value}
      accessibilityLabel={label}
      onPress={() => onChange(value)}
      style={{ flex: 1, minHeight: minTapTarget - 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text variant="bodyStrong" tone={interval === value ? undefined : 'muted'} style={interval === value ? { color: colors.onAccent } : undefined}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, gap: spacing.xs / 2 }}
    >
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, bottom: 4, width: half, borderRadius: radius.pill, backgroundColor: colors.accent, transform: [{ translateX }] }} />
      {option('month', t.monthly)}
      {option('year', t.annual)}
    </View>
  );
}

/**
 * One plan card, a radio in a single-choice group. Tap or click anywhere to select. Only the selected card has the accent
 * border, the tinted background and the check mark (and the word "Selected", so colour is never the only signal).
 * Selecting animates the colours and pops the check in. Web: unselected cards lighten their border and lift on hover, and
 * show a focus ring for the keyboard. Pressed: a slight shrink. Reduced motion: instant colours, no pop, no shrink.
 */
function PlanCard({ selected, label, onSelect, onKey, cardRef, children }: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  onKey?: (e: { key: string; preventDefault: () => void }) => void;
  cardRef: (node: { focus?: () => void } | null) => void;
  children: ReactNode;
}) {
  const { colors, radius, spacing, elevation, minTapTarget } = useTheme();
  const reduced = useReducedMotion();
  const press = usePressSpring(0.98);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) on.setValue(selected ? 1 : 0);
    else Animated.timing(on, { toValue: selected ? 1 : 0, duration: durationFor('base', false) - 50, easing: easing('standard'), useNativeDriver: false }).start();
  }, [selected, reduced, on]);
  const idle = hovered && !selected ? mixColors(colors.border, colors.accent, 0.5) : colors.border;
  const borderColor = on.interpolate({ inputRange: [0, 1], outputRange: [idle, colors.accent] });
  const backgroundColor = on.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, mixColors(colors.surface, colors.accent, 0.12)] });
  // The check pops in on the new card (a short overshoot) and fades out on the old one.
  const checkScale = on.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 1.15, 1] });
  const webProps = Platform.OS === 'web'
    ? ({
        onKeyDown: onKey,
        tabIndex: selected ? 0 : -1,
        onFocus: (e: { target?: { matches?: (s: string) => boolean } }) => setFocused(Boolean(e.target?.matches?.(':focus-visible'))),
        onBlur: () => setFocused(false),
      } as object)
    : {};
  return (
    <Pressable
      ref={cardRef as never}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onSelect}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{ minHeight: minTapTarget, borderRadius: radius.lg }}
      {...webProps}
    >
      <Animated.View style={{ transform: [{ scale: press.scale }] }}>
        <Animated.View
          style={[
            { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 2, borderColor, backgroundColor },
            // Hover lifts an unselected card a little; a selected card does not change on hover.
            hovered && !selected ? elevation.mid : undefined,
            focused ? { outlineStyle: 'solid', outlineWidth: 3, outlineColor: colors.accent, outlineOffset: 2 } as object : undefined,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 24 }}>
            <Animated.View style={{ opacity: on, transform: [{ scale: checkScale }] }}>
              <Icon name="checkmark-circle" tone="accent" size={22} />
            </Animated.View>
            <Animated.View style={{ opacity: on }}>
              <Text variant="small" tone="accent">{selected ? t.selected : ' '}</Text>
            </Animated.View>
          </View>
          {children}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
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
