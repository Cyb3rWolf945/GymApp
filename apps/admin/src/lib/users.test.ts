import { describe, expect, it } from 'vitest';
import { EXPORT_TABLES as SHARED_EXPORT_TABLES, EXPORT_HIDE_COLUMNS } from '../../../../packages/shared/src/legal/export';
import { AUDIT_ACTIONS } from './audit';
import { EXPORT_TABLES, HIDDEN_COLUMNS, buildExport } from './export';
import { MAX_COMP_DAYS, canComp, cleanSearch, deleteConfirmed, maskEmail, validateCompGrant } from './users';

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('ana.silva@example.com')).toBe('a***@example.com');
    expect(maskEmail('x@y.co')).toBe('x***@y.co');
    expect(maskEmail('a@b@c.com')).toBe('a***@c.com');
  });
  it('never leaks anything from odd input', () => {
    expect(maskEmail(null)).toBe('(no email)');
    expect(maskEmail('')).toBe('(no email)');
    expect(maskEmail('no-at-sign')).toBe('***');
    expect(maskEmail('@nolocal.com')).toBe('***');
  });
});

describe('cleanSearch', () => {
  it('trims and caps the search text', () => {
    expect(cleanSearch('  ana  ')).toBe('ana');
    expect(cleanSearch(undefined)).toBe('');
    expect(cleanSearch('x'.repeat(500))).toHaveLength(100);
  });
});

describe('validateCompGrant', () => {
  const now = new Date('2026-12-01T10:00:00Z');
  it('accepts a tier with a future end date and ends it at the end of that day', () => {
    expect(validateCompGrant({ tier: 'pro', endDate: '2027-01-15' }, now)).toEqual({ ok: true, tier: 'pro', endsAt: '2027-01-15T23:59:59.000Z' });
    expect(validateCompGrant({ tier: 'elite', endDate: '2026-12-01' }, now)).toMatchObject({ ok: true }); // later today
  });
  it('rejects a bad tier, a malformed or impossible date, and the past', () => {
    expect(validateCompGrant({ tier: 'none', endDate: '2027-01-01' }, now)).toEqual({ ok: false, error: 'Pick a tier.' });
    expect(validateCompGrant({ tier: 'gold', endDate: '2027-01-01' }, now).ok).toBe(false);
    expect(validateCompGrant({ tier: 'pro', endDate: '' }, now)).toEqual({ ok: false, error: 'Pick an end date.' });
    expect(validateCompGrant({ tier: 'pro', endDate: '01/01/2027' }, now).ok).toBe(false);
    expect(validateCompGrant({ tier: 'pro', endDate: '2027-02-30' }, now)).toEqual({ ok: false, error: 'That date does not exist.' });
    expect(validateCompGrant({ tier: 'pro', endDate: '2026-11-30' }, now)).toEqual({ ok: false, error: 'The end date must be in the future.' });
  });
  it('rejects an end date more than a year away', () => {
    expect(validateCompGrant({ tier: 'pro', endDate: '2027-12-01' }, now).ok).toBe(true);
    expect(validateCompGrant({ tier: 'pro', endDate: '2028-06-01' }, now)).toEqual({ ok: false, error: `The end date can be at most ${MAX_COMP_DAYS} days away.` });
  });
});

describe('canComp and deleteConfirmed', () => {
  it('does not comp over a live Stripe subscription', () => {
    expect(canComp(null)).toBe(true);
    expect(canComp({ stripe_subscription_id: null, status: 'none' })).toBe(true);
    expect(canComp({ stripe_subscription_id: 'sub_1', status: 'canceled' })).toBe(true);
    for (const status of ['active', 'trialing', 'past_due']) expect(canComp({ stripe_subscription_id: 'sub_1', status }), status).toBe(false);
  });
  it('needs the typed email (any case, trimmed) or the id when there is no email', () => {
    const user = { id: '00000000-0000-4000-8000-0000000000aa', email: 'Ana@Example.com' };
    expect(deleteConfirmed(' ana@example.com ', user)).toBe(true);
    expect(deleteConfirmed('DELETE', user)).toBe(false);
    expect(deleteConfirmed('', user)).toBe(false);
    expect(deleteConfirmed(user.id, { ...user, email: null })).toBe(true);
  });
});

describe('admin export', () => {
  it('uses the same tables and hidden columns as the user-facing export (they must not drift)', () => {
    expect([...EXPORT_TABLES]).toEqual([...SHARED_EXPORT_TABLES]);
    expect(HIDDEN_COLUMNS).toEqual(EXPORT_HIDE_COLUMNS);
  });
  it('has a key for every table and hides the Stripe ids', () => {
    const out = buildExport('u1', 'a@b.co', { entitlements: [{ user_id: 'u1', tier: 'pro', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }] }, new Date('2026-12-01T00:00:00Z'));
    expect(Object.keys(out.data).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(out.data.entitlements).toEqual([{ user_id: 'u1', tier: 'pro' }]);
  });
});

describe('audit actions for E-32', () => {
  it('has an action for each thing an admin can do here', () => {
    for (const a of ['grant_comp', 'regenerate_plan', 'resend_magic_link', 'export_user_data', 'delete_user', 'review_guardrail', 'view_guardrail_queue']) expect(AUDIT_ACTIONS).toContain(a);
  });
});

import { ACTION_LABELS, GUARDRAIL_LABELS, adherence, currentPlan, generationHistory, stripeCustomerUrl, type JobRow } from './userview';

const job = (o: Partial<JobRow>): JobRow => ({ id: 'j', kind: 'workout_plan', status: 'done', created_at: '2026-11-20T10:00:00Z', needs_review: false, result: null, ...o });

describe('generationHistory', () => {
  it('shows source, attempts and QA scores per generation', () => {
    const [a, b, c] = generationHistory([
      job({ id: 'a', result: { source: 'planner', attempts: [{ outcome: 'passed' }], qa: { criteria: [{ score: 5 }, { score: 4 }, { score: 3 }] } } }),
      job({ id: 'b', result: { source: 'template', attempts: [{}, {}, {}], qa: null }, needs_review: true }),
      job({ id: 'c', status: 'failed', result: null }),
    ]);
    expect(a).toMatchObject({ source: 'planner', attempts: 1, qaMin: 3, qaAvg: 4 });
    expect(b).toMatchObject({ source: 'template', attempts: 3, qaMin: null, needsReview: true });
    expect(c).toMatchObject({ status: 'failed', source: '–', attempts: 0 });
  });
});

describe('currentPlan', () => {
  it('uses the newest finished job of each kind', () => {
    const plan = currentPlan([
      job({ id: 'old', created_at: '2026-11-01T00:00:00Z', result: { plan: { split: 'full_body', days: [{ name: 'A', exercises: [1] }] } } }),
      job({ id: 'new', created_at: '2026-11-10T00:00:00Z', result: { plan: { split: 'upper_lower', days: [{ name: 'Upper', exercises: [1, 2] }, { name: 'Lower', exercises: [1] }] } } }),
      job({ id: 'n', kind: 'nutrition_plan', result: { plan: { days: [{ dayType: 'training', kcal: 2400, meals: [1, 2, 3] }] } } }),
      job({ id: 'f', created_at: '2026-11-15T00:00:00Z', status: 'failed' }),
    ]);
    expect(plan.workout).toMatchObject({ split: 'upper_lower', days: [{ name: 'Upper', exercises: 2 }, { name: 'Lower', exercises: 1 }] });
    expect(plan.nutrition).toMatchObject({ days: [{ dayType: 'training', kcal: 2400, meals: 3 }] });
    expect(currentPlan([])).toEqual({ workout: null, nutrition: null });
  });
});

describe('adherence', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  it('is finished workouts over planned ones in the last 4 weeks, capped at 100%', () => {
    expect(adherence(['2026-11-30T08:00:00Z', '2026-11-25T08:00:00Z', '2026-11-10T08:00:00Z', '2026-10-01T08:00:00Z', '2026-12-05T08:00:00Z'], 3, now)).toEqual({ done: 3, planned: 12, rate: 0.25 });
    expect(adherence(Array(20).fill('2026-11-28T08:00:00Z'), 3, now).rate).toBe(1);
  });
  it('has no rate without a plan', () => {
    expect(adherence(['2026-11-30T08:00:00Z'], 0, now)).toEqual({ done: 1, planned: 0, rate: null });
  });
});

describe('stripeCustomerUrl and labels', () => {
  it('links a customer id and nothing else', () => {
    expect(stripeCustomerUrl('cus_ABC123')).toBe('https://dashboard.stripe.com/customers/cus_ABC123');
    expect(stripeCustomerUrl('cus_ABC123', 'https://dashboard.stripe.com/test/')).toBe('https://dashboard.stripe.com/test/customers/cus_ABC123');
    expect(stripeCustomerUrl(null)).toBeNull();
    expect(stripeCustomerUrl('sub_1')).toBeNull();
    expect(stripeCustomerUrl('cus_1/../../x')).toBeNull();
  });
  it('labels every guardrail category and action the pipeline can write', () => {
    for (const k of ['injection', 'off_topic', 'medical_red_flag', 'too_long', 'unclassified']) expect(GUARDRAIL_LABELS[k], k).toBeTruthy();
    for (const k of ['blocked', 'dropped', 'blocked_unclassified', 'truncated', 'conservative_mode']) expect(ACTION_LABELS[k], k).toBeTruthy();
  });
});
