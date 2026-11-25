import { describe, expect, it } from 'vitest';
import type { StripeEvent } from '../payments/entitlements.ts';
import { CLIENT_EVENTS, ClientTrackSchema, EVENT_NAMES, SERVER_EVENTS, type AnalyticsRow, track } from './events.ts';
import { analyticsFromStripeEvent } from './stripe-events.ts';

const anonId = 'anon-12345678';

describe('event catalogue', () => {
  it('has every event the issue lists, split into client and server events', () => {
    for (const n of ['landing_view', 'quiz_start', 'quiz_complete', 'signup', 'onboarding_step_viewed', 'onboarding_finished', 'plan_preview_view', 'paywall_view', 'checkout_start', 'trial_start', 'purchase', 'workout_logged']) {
      expect(EVENT_NAMES).toContain(n);
    }
    expect([...CLIENT_EVENTS, ...SERVER_EVENTS].sort()).toEqual([...EVENT_NAMES].sort());
  });
  it('money and identity events cannot be sent by clients', () => {
    for (const name of SERVER_EVENTS) expect(ClientTrackSchema.safeParse({ anonId, name, props: {} }).success, name).toBe(false);
  });
});

describe('ClientTrackSchema', () => {
  it('accepts valid events with typed props', () => {
    expect(ClientTrackSchema.safeParse({ anonId, name: 'paywall_view', props: { variant: 'a' } }).success).toBe(true);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'onboarding_step_viewed', props: { step: 'basics', screen: 1, version: 1 } }).success).toBe(true);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'workout_logged', props: { sets: 12, minutes: 40 } }).success).toBe(true);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'quiz_start' }).success).toBe(true);
  });
  it('accepts the account modal events: viewed, and which sign-in method was chosen (an enum, never an email)', () => {
    expect(ClientTrackSchema.safeParse({ anonId, name: 'account_modal_view', props: {} }).success).toBe(true);
    for (const method of ['password', 'email_code', 'google', 'apple']) {
      expect(ClientTrackSchema.safeParse({ anonId, name: 'signin_method_chosen', props: { method } }).success, method).toBe(true);
    }
    expect(ClientTrackSchema.safeParse({ anonId, name: 'signin_method_chosen', props: { method: 'a@b.co' } }).success).toBe(false);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'signin_method_chosen', props: { method: 'google', email: 'a@b.co' } }).success).toBe(false);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'account_modal_view', props: { email: 'a@b.co' } }).success).toBe(false);
  });
  it('accepts landing_view with UTM tags and the marketing ids, and rejects other keys', () => {
    expect(ClientTrackSchema.safeParse({ anonId, name: 'landing_view', props: { utm_source: 'meta', utm_campaign: 'launch' }, marketing: { fbp: 'fb.1.1.2' } }).success).toBe(true);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'landing_view', props: { email: 'a@b.co' } }).success).toBe(false);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'quiz_complete', props: {}, marketing: { email: 'a@b.co' } }).success).toBe(false);
  });
  it('rejects unknown events, wrong prop types and extra props (no free text or answers)', () => {
    expect(ClientTrackSchema.safeParse({ anonId, name: 'drop_table', props: {} }).success).toBe(false);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'workout_logged', props: { sets: 'many', minutes: 40 } }).success).toBe(false);
    expect(ClientTrackSchema.safeParse({ anonId, name: 'paywall_view', props: { note: 'I have a knee injury' } }).success).toBe(false);
    expect(ClientTrackSchema.safeParse({ anonId: 'short', name: 'quiz_start', props: {} }).success).toBe(false);
  });
});

describe('track', () => {
  it('writes a row to the sink and validates props at runtime', async () => {
    const rows: AnalyticsRow[] = [];
    await track((r) => void rows.push(r), { userId: 'u1' }, 'checkout_start', { price_key: 'pro_annual' });
    expect(rows).toEqual([{ user_id: 'u1', anon_id: null, name: 'checkout_start', props: { price_key: 'pro_annual' } }]);
    await expect(track((r) => void rows.push(r), {}, 'workout_logged', { sets: -1, minutes: 1 })).rejects.toThrow();
    expect(rows).toHaveLength(1);
  });
});

describe('analyticsFromStripeEvent', () => {
  const ev = (type: string, object: Record<string, unknown>): StripeEvent => ({ id: 'evt_1', type, created: 1, data: { object } });
  it('records trial_start when a subscription is created in trialing', () => {
    const out = analyticsFromStripeEvent(ev('customer.subscription.created', { id: 'sub_9' }), { kind: 'update', userId: 'u1', patch: { status: 'trialing', tier: 'pro' } });
    expect(out).toEqual({ userId: 'u1', name: 'trial_start', props: { tier: 'pro' }, sourceId: 'sub_9' });
    expect(analyticsFromStripeEvent(ev('customer.subscription.created', {}), { kind: 'update', userId: 'u1', patch: { status: 'active', tier: 'pro' } })).toBeNull();
    expect(analyticsFromStripeEvent(ev('customer.subscription.updated', {}), { kind: 'update', userId: 'u1', patch: { status: 'trialing', tier: 'pro' } })).toBeNull();
  });
  it('records purchase for paid invoices only', () => {
    const invoice = (amount_paid: number) => ev('invoice.paid', { id: 'in_7', amount_paid, billing_reason: 'subscription_create', lines: { data: [{ price: { lookup_key: 'elite_monthly' } }] } });
    const outcome = { kind: 'update' as const, userId: 'u1', patch: { status: 'active' } };
    expect(analyticsFromStripeEvent(invoice(2499), outcome)).toEqual({ userId: 'u1', name: 'purchase', props: { tier: 'elite', interval: 'month', amount_usd: 24.99, reason: 'subscription_create' }, sourceId: 'in_7' });
    expect(analyticsFromStripeEvent(invoice(0), outcome)).toBeNull();
    expect(analyticsFromStripeEvent(ev('invoice.paid', { amount_paid: 100, lines: { data: [] } }), outcome)).toBeNull();
    expect(analyticsFromStripeEvent(invoice(2499), { kind: 'ignored', reason: 'x' })).toBeNull();
  });
});
