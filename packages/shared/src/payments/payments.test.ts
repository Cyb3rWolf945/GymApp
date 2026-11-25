import { describe, expect, it } from 'vitest';
import { type Deps, type EntitlementRow, type StripeEvent, type StripeSubscription, handleStripeEvent, hasAccess, patchFromSubscription } from './entitlements.ts';
import { FOUNDING_COUPON, PRICES, priceByKey, tierOfLookupKey } from './pricing.ts';
import { aggregateRevenue } from './revenue.ts';
import { signStripePayload, verifyStripeSignature } from './signature.ts';
import { encodeForm } from './stripe-api.ts';

const T0 = 1_800_000_000;
const sub = (over: Partial<StripeSubscription> = {}): StripeSubscription => ({
  id: 'sub_1', customer: 'cus_1', status: 'active', current_period_end: T0 + 30 * 86400, cancel_at_period_end: false,
  metadata: { user_id: 'u1' }, items: { data: [{ price: { lookup_key: 'pro_monthly' } }] }, ...over,
});
const event = (type: string, object: object, created = T0): StripeEvent => ({ id: `evt_${type}`, type, created, data: { object: object as Record<string, unknown> } });
const deps = (over: Partial<Deps> = {}): Deps => ({
  findUserByCustomer: async (c) => (c === 'cus_1' ? 'u1' : null),
  getEntitlement: async () => null,
  getSubscription: async () => sub(),
  getChargeCustomer: async () => 'cus_1',
  ...over,
});

describe('pricing', () => {
  it('has the six prices, trials on annual only, and the founding coupon matches Pro annual', () => {
    expect(PRICES.map((p) => [p.lookupKey, p.cents, p.trialDays])).toEqual([
      ['basic_monthly', 999, 0], ['basic_annual', 5999, 7], ['pro_monthly', 1999, 0], ['pro_annual', 11999, 7], ['elite_monthly', 2499, 0], ['elite_annual', 14999, 7],
    ]);
    expect(priceByKey(FOUNDING_COUPON.lookupKey)!.cents - FOUNDING_COUPON.amountOffCents).toBe(7999);
    expect(tierOfLookupKey('elite_annual')).toBe('elite');
    expect(tierOfLookupKey('nope')).toBe('none');
  });
});

describe('verifyStripeSignature', () => {
  const body = '{"id":"evt_1"}';
  it('accepts a valid signature and rejects tampering, wrong secret, missing header and replays', async () => {
    const header = await signStripePayload(body, 'whsec_a', T0);
    expect(await verifyStripeSignature(body, header, 'whsec_a', T0 + 10)).toBe(true);
    expect(await verifyStripeSignature(body + ' ', header, 'whsec_a', T0 + 10)).toBe(false);
    expect(await verifyStripeSignature(body, header, 'whsec_b', T0 + 10)).toBe(false);
    expect(await verifyStripeSignature(body, null, 'whsec_a', T0)).toBe(false);
    expect(await verifyStripeSignature(body, 'garbage', 'whsec_a', T0)).toBe(false);
    expect(await verifyStripeSignature(body, header, 'whsec_a', T0 + 301)).toBe(false);
  });
  it('accepts any matching v1 entry', async () => {
    const good = (await signStripePayload(body, 'whsec_a', T0)).split(',v1=')[1];
    expect(await verifyStripeSignature(body, `t=${T0},v1=bad,v1=${good}`, 'whsec_a', T0)).toBe(true);
  });
});

describe('handleStripeEvent', () => {
  it('checkout.session.completed grants the tier from the subscription', async () => {
    const out = await handleStripeEvent(event('checkout.session.completed', { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: 'u1' }), deps());
    expect(out).toMatchObject({ kind: 'update', userId: 'u1', patch: { tier: 'pro', status: 'active', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' } });
  });
  it('subscription created/updated map status and cancel_at_period_end; trialing keeps the tier', async () => {
    const out = await handleStripeEvent(event('customer.subscription.updated', sub({ status: 'trialing', cancel_at_period_end: true })), deps());
    expect(out).toMatchObject({ kind: 'update', patch: { tier: 'pro', status: 'trialing', cancel_at_period_end: true } });
  });
  it('subscription.deleted revokes', async () => {
    const out = await handleStripeEvent(event('customer.subscription.deleted', sub({ status: 'active' })), deps());
    expect(out).toMatchObject({ kind: 'update', patch: { tier: 'none', status: 'canceled' } });
  });
  it('falls back to the customer id when the subscription has no user metadata', async () => {
    const out = await handleStripeEvent(event('customer.subscription.created', sub({ metadata: {} })), deps());
    expect(out).toMatchObject({ kind: 'update', userId: 'u1' });
    expect(await handleStripeEvent(event('customer.subscription.created', sub({ metadata: {}, customer: 'cus_x' })), deps())).toEqual({ kind: 'ignored', reason: 'unknown user' });
  });
  it('invoice.paid extends the period and clears past_due', async () => {
    const out = await handleStripeEvent(event('invoice.paid', { customer: 'cus_1', lines: { data: [{ period: { end: T0 + 100 } }, { period: { end: T0 + 200 } }] } }), deps());
    expect(out).toEqual({ kind: 'update', userId: 'u1', patch: { status: 'active', past_due_since: null, current_period_end: new Date((T0 + 200) * 1000).toISOString() } });
  });
  it('invoice.payment_failed starts the grace window once and keeps it on retries', async () => {
    const first = await handleStripeEvent(event('invoice.payment_failed', { customer: 'cus_1' }, T0), deps());
    expect(first).toMatchObject({ patch: { status: 'past_due', past_due_since: new Date(T0 * 1000).toISOString() } });
    const since = new Date((T0 - 86400) * 1000).toISOString();
    const retry = await handleStripeEvent(event('invoice.payment_failed', { customer: 'cus_1' }, T0), deps({ getEntitlement: async () => ({ status: 'past_due', past_due_since: since }) }));
    expect(retry).toMatchObject({ patch: { past_due_since: since } });
  });
  it('trial_will_end changes nothing', async () => {
    expect((await handleStripeEvent(event('customer.subscription.trial_will_end', sub()), deps())).kind).toBe('ignored');
  });
  it('full refunds and disputes revoke; partial refunds do not', async () => {
    expect(await handleStripeEvent(event('charge.refunded', { customer: 'cus_1', refunded: true }), deps())).toMatchObject({ patch: { tier: 'none', status: 'refunded' } });
    expect((await handleStripeEvent(event('charge.refunded', { customer: 'cus_1', refunded: false }), deps())).kind).toBe('ignored');
    expect(await handleStripeEvent(event('charge.dispute.created', { charge: 'ch_1' }), deps())).toMatchObject({ patch: { tier: 'none', status: 'disputed' } });
  });
  it('ignores events it does not handle', async () => {
    expect((await handleStripeEvent(event('customer.created', {}), deps())).kind).toBe('ignored');
  });
});

describe('patchFromSubscription', () => {
  it('keeps the price key so the admin can tell monthly from annual', () => {
    expect(patchFromSubscription(sub())).toMatchObject({ price_key: 'pro_monthly' });
    expect(patchFromSubscription(sub({ items: { data: [{ price: { lookup_key: 'elite_annual' } }] } }))).toMatchObject({ tier: 'elite', price_key: 'elite_annual' });
    expect(patchFromSubscription(sub({ status: 'canceled' }))).toMatchObject({ price_key: null });
  });
  it('maps dead statuses to no tier', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete_expired']) expect(patchFromSubscription(sub({ status }))).toMatchObject({ tier: 'none', status: 'canceled' });
  });
});

describe('hasAccess', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  const ent = (o: Partial<EntitlementRow> = {}) => ({ tier: 'pro' as const, status: 'active', current_period_end: '2026-12-15T00:00:00Z', past_due_since: null, ...o });
  it('needs a paid tier, a good status and an unexpired period', () => {
    expect(hasAccess(ent(), 'basic', now)).toBe(true);
    expect(hasAccess(ent({ status: 'trialing' }), 'basic', now)).toBe(true);
    expect(hasAccess(null, 'basic', now)).toBe(false);
    expect(hasAccess(ent({ tier: 'none' }), 'basic', now)).toBe(false);
    expect(hasAccess(ent({ status: 'canceled' }), 'basic', now)).toBe(false);
    expect(hasAccess(ent({ current_period_end: '2026-11-30T00:00:00Z' }), 'basic', now)).toBe(false);
    expect(hasAccess(ent({ current_period_end: null }), 'basic', now)).toBe(false);
  });
  it('past_due keeps access for 7 days from the first failure', () => {
    expect(hasAccess(ent({ status: 'past_due', past_due_since: '2026-11-26T00:00:00Z' }), 'basic', now)).toBe(true);
    expect(hasAccess(ent({ status: 'past_due', past_due_since: '2026-11-24T00:00:00Z' }), 'basic', now)).toBe(false);
    expect(hasAccess(ent({ status: 'past_due', past_due_since: null }), 'basic', now)).toBe(false);
  });
  it('features beyond basic need Pro or Elite', () => {
    expect(hasAccess(ent({ tier: 'basic' }), 'nutrition', now)).toBe(false);
    expect(hasAccess(ent({ tier: 'elite' }), 'nutrition', now)).toBe(true);
  });
});

describe('aggregateRevenue', () => {
  it('splits gross, fees and refunds per day and tier, and skips other types', () => {
    const d1 = T0, d2 = T0 + 86400;
    const tier = (c: string | null) => (c === 'cus_1' ? 'pro' : 'none') as 'pro' | 'none';
    const rows = aggregateRevenue(
      [
        { type: 'charge', amount: 1999, fee: 88, created: d1, customer: 'cus_1' },
        { type: 'charge', amount: 1999, fee: 88, created: d1, customer: 'cus_1' },
        { type: 'refund', amount: -1999, fee: 0, created: d2, customer: 'cus_1' },
        { type: 'payout', amount: -5000, fee: 0, created: d2, customer: null },
      ],
      tier,
    );
    expect(rows).toEqual([
      { day: new Date(d1 * 1000).toISOString().slice(0, 10), tier: 'pro', gross_usd: 39.98, fees_usd: 1.76, refunds_usd: 0 },
      { day: new Date(d2 * 1000).toISOString().slice(0, 10), tier: 'pro', gross_usd: 0, fees_usd: 0, refunds_usd: 19.99 },
    ]);
  });
});

describe('encodeForm', () => {
  it('encodes nested objects and arrays and skips empty values', () => {
    expect(decodeURIComponent(encodeForm({ mode: 'subscription', line_items: [{ price: 'p1', quantity: 1 }], metadata: { a: 'x y' }, skip: undefined, none: null }))).toBe(
      'mode=subscription&line_items[0][price]=p1&line_items[0][quantity]=1&metadata[a]=x y',
    );
  });
});
