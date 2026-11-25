import { type EventOutcome, type StripeEvent } from '../payments/entitlements.ts';
import { priceByKey } from '../payments/pricing.ts';
import type { AnalyticsEventName, EventProps } from './events.ts';

export interface DerivedEvent<N extends AnalyticsEventName = AnalyticsEventName> {
  userId: string;
  name: N;
  props: EventProps<N>;
  /** Stripe object behind the event (subscription for a trial, invoice for a purchase): the dedup id for Meta. */
  sourceId?: string;
}

/**
 * Money events from Stripe, for `analytics_events`. The webhook is idempotent by `event.id`, so each Stripe event
 * yields at most one row.
 * - `trial_start`: a subscription is created in `trialing`.
 * - `purchase`: an invoice with an amount above zero is paid (`reason` = Stripe's billing_reason).
 */
export function analyticsFromStripeEvent(event: StripeEvent, outcome: EventOutcome): DerivedEvent | null {
  if (outcome.kind !== 'update') return null;
  const obj = event.data.object;
  if (event.type === 'customer.subscription.created' && outcome.patch.status === 'trialing') {
    const tier = outcome.patch.tier;
    return tier && tier !== 'none' ? { userId: outcome.userId, name: 'trial_start', props: { tier }, sourceId: String(obj.id ?? '') || undefined } : null;
  }
  if (event.type === 'invoice.paid' && Number(obj.amount_paid) > 0) {
    const key = (obj.lines?.data as { price?: { lookup_key?: string | null } }[] | undefined)?.[0]?.price?.lookup_key;
    const price = key ? priceByKey(key) : undefined;
    if (!price) return null;
    return {
      userId: outcome.userId,
      name: 'purchase',
      props: { tier: price.tier, interval: price.interval, amount_usd: Number(obj.amount_paid) / 100, reason: String(obj.billing_reason ?? 'unknown').slice(0, 40) },
      sourceId: String(obj.id ?? '') || undefined,
    };
  }
  return null;
}
