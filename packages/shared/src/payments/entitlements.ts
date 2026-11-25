import { FEATURE_MIN_TIER, type Feature, type Tier, tierIncludes, tierOfLookupKey } from './pricing.ts';

// Stripe events -> `entitlements` row. Pure: network and database access come in through `Deps`, so the
// whole mapping is unit-tested. Access itself is decided in SQL (`has_access`) and mirrored by `hasAccess`.

export const PAST_DUE_GRACE_DAYS = 7;

export interface EntitlementRow {
  user_id: string;
  tier: Tier;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  past_due_since: string | null;
  /** Stripe lookup key of the price, e.g. `pro_annual`. Lets the admin tell monthly from annual (MRR). */
  price_key: string | null;
}
export type EntitlementPatch = Partial<Omit<EntitlementRow, 'user_id'>>;

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data: { current_period_end?: number; price?: { lookup_key?: string | null } }[] };
}
export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const iso = (seconds: number | undefined | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

const STATUS_MAP: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due',
  canceled: 'canceled', unpaid: 'canceled', incomplete_expired: 'canceled', incomplete: 'incomplete', paused: 'canceled',
};

/** Entitlement fields for a Stripe subscription object. */
export function patchFromSubscription(sub: StripeSubscription, current?: Pick<EntitlementRow, 'status' | 'past_due_since'> | null, eventTime?: number): EntitlementPatch {
  const status = STATUS_MAP[sub.status] ?? 'canceled';
  const item = sub.items?.data[0];
  const dead = status === 'canceled';
  return {
    tier: dead ? 'none' : tierOfLookupKey(item?.price?.lookup_key),
    status,
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    price_key: dead ? null : (item?.price?.lookup_key ?? null),
    // The grace window starts when payments first fail, not at every retry.
    past_due_since: status === 'past_due' ? (current?.status === 'past_due' && current.past_due_since ? current.past_due_since : iso(eventTime)) : null,
  };
}

export interface Deps {
  findUserByCustomer(customerId: string): Promise<string | null>;
  getEntitlement(userId: string): Promise<Pick<EntitlementRow, 'status' | 'past_due_since'> | null>;
  getSubscription(subscriptionId: string): Promise<StripeSubscription>;
  /** Customer of a charge (disputes only carry the charge id). */
  getChargeCustomer(chargeId: string): Promise<string | null>;
}

export type EventOutcome =
  | { kind: 'update'; userId: string; patch: EntitlementPatch }
  | { kind: 'ignored'; reason: string };

export const HANDLED_EVENTS = [
  'checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'customer.subscription.trial_will_end', 'charge.refunded', 'charge.dispute.created',
] as const;

const ignored = (reason: string): EventOutcome => ({ kind: 'ignored', reason });

export async function handleStripeEvent(event: StripeEvent, deps: Deps): Promise<EventOutcome> {
  const obj = event.data.object;
  const userFor = async (customer: string | null | undefined, metadataUser?: string) => metadataUser || (customer ? await deps.findUserByCustomer(customer) : null);

  switch (event.type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription' || !obj.subscription) return ignored('not a subscription checkout');
      const userId = await userFor(obj.customer, obj.client_reference_id ?? undefined);
      if (!userId) return ignored('unknown user');
      const sub = await deps.getSubscription(obj.subscription);
      return { kind: 'update', userId, patch: patchFromSubscription(sub, await deps.getEntitlement(userId), event.created) };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = obj as StripeSubscription;
      const userId = await userFor(sub.customer, sub.metadata?.user_id);
      if (!userId) return ignored('unknown user');
      const patch = patchFromSubscription(event.type === 'customer.subscription.deleted' ? { ...sub, status: 'canceled' } : sub, await deps.getEntitlement(userId), event.created);
      return { kind: 'update', userId, patch };
    }
    case 'invoice.paid': {
      const userId = await userFor(obj.customer);
      if (!userId) return ignored('unknown user');
      const end = (obj.lines?.data as { period?: { end?: number } }[] | undefined)?.map((l) => l.period?.end ?? 0).sort((a, b) => b - a)[0];
      return { kind: 'update', userId, patch: { status: 'active', past_due_since: null, ...(end ? { current_period_end: iso(end) } : {}) } };
    }
    case 'invoice.payment_failed': {
      const userId = await userFor(obj.customer);
      if (!userId) return ignored('unknown user');
      const current = await deps.getEntitlement(userId);
      return { kind: 'update', userId, patch: { status: 'past_due', past_due_since: current?.status === 'past_due' && current.past_due_since ? current.past_due_since : iso(event.created) } };
    }
    case 'customer.subscription.trial_will_end':
      return ignored('trial_will_end: no access change');
    case 'charge.refunded': {
      if (!obj.refunded) return ignored('partial refund');
      const userId = await userFor(obj.customer);
      return userId ? { kind: 'update', userId, patch: { tier: 'none', status: 'refunded', past_due_since: null } } : ignored('unknown user');
    }
    case 'charge.dispute.created': {
      const customer = typeof obj.charge === 'string' ? await deps.getChargeCustomer(obj.charge) : null;
      const userId = await userFor(customer);
      return userId ? { kind: 'update', userId, patch: { tier: 'none', status: 'disputed', past_due_since: null } } : ignored('unknown user');
    }
    default:
      return ignored(`unhandled event ${event.type}`);
  }
}

/** TS mirror of the SQL `has_access`. Keep both in sync (the SQL one is the source of truth). */
export function hasAccess(ent: Pick<EntitlementRow, 'tier' | 'status' | 'current_period_end' | 'past_due_since'> | null | undefined, feature: Feature | 'basic' = 'basic', now = new Date()): boolean {
  if (!ent || ent.tier === 'none' || !ent.current_period_end) return false;
  if (new Date(ent.current_period_end) <= now) return false;
  const statusOk =
    ent.status === 'active' || ent.status === 'trialing' ||
    (ent.status === 'past_due' && !!ent.past_due_since && now.getTime() < new Date(ent.past_due_since).getTime() + PAST_DUE_GRACE_DAYS * 86_400_000);
  if (!statusOk) return false;
  return feature === 'basic' || (feature in FEATURE_MIN_TIER ? tierIncludes(ent.tier, feature) : ent.tier === 'pro' || ent.tier === 'elite');
}
