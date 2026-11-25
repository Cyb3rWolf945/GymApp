import { describe, expect, it } from 'vitest';
import {
  type EntitlementRow, type GenerationDay, type PriceRow, classifyValidationError, costPerTrial, failureTypes, generationSummary, margin, monthlyChurn,
  otherCosts, screenDropOff, sourceOptions, subscriptions, trialConversion,
} from './kpis';

const prices: PriceRow[] = [
  { lookup_key: 'basic_monthly', tier: 'basic', interval: 'month', cents: 999, variant: 'default' },
  { lookup_key: 'pro_monthly', tier: 'pro', interval: 'month', cents: 1999, variant: 'default' },
  { lookup_key: 'pro_annual', tier: 'pro', interval: 'year', cents: 11999, variant: 'default' },
  { lookup_key: 'pro_monthly', tier: 'pro', interval: 'month', cents: 1499, variant: 'test-b' },
  { lookup_key: 'elite_monthly', tier: 'elite', interval: 'month', cents: 2499, variant: 'default' },
];
const ent = (tier: string, status: string, price_key: string | null = null, updated_at = '2026-11-10T00:00:00Z'): EntitlementRow => ({ tier, status, price_key, updated_at });

describe('subscriptions (MRR)', () => {
  it('counts monthly at list price and annual divided by 12, by tier', () => {
    const s = subscriptions([ent('basic', 'active', 'basic_monthly'), ent('pro', 'active', 'pro_monthly'), ent('pro', 'active', 'pro_annual'), ent('elite', 'active', 'elite_monthly')], prices);
    expect(s.byTier.pro).toEqual({ subs: 2, mrrCents: 1999 + 1000 }); // 11999 / 12 = 999.9 -> 1000
    expect(s.mrrCents).toBe(999 + 1999 + 1000 + 2499);
    expect(s.paying).toBe(4);
    expect(s.arpuCents).toBe(Math.round((999 + 1999 + 1000 + 2499) / 4));
  });
  it('counts trials separately and does not put them in MRR', () => {
    const s = subscriptions([ent('pro', 'trialing', 'pro_annual'), ent('pro', 'active', 'pro_monthly')], prices);
    expect(s).toMatchObject({ trials: 1, paying: 1, mrrCents: 1999 });
  });
  it('keeps past-due subscribers (grace period) and ignores canceled, refunded and unknown tiers', () => {
    const s = subscriptions([ent('pro', 'past_due', 'pro_monthly'), ent('pro', 'canceled', 'pro_monthly'), ent('pro', 'refunded'), ent('none', 'active'), ent('weird', 'active')], prices);
    expect(s).toMatchObject({ paying: 1, mrrCents: 1999 });
  });
  it('uses the tier monthly price for rows without a price key, and the default variant over A/B variants', () => {
    expect(subscriptions([ent('pro', 'active', null)], prices).mrrCents).toBe(1999);
    expect(subscriptions([ent('pro', 'active', 'pro_monthly')], prices.filter((p) => p.variant !== 'default')).mrrCents).toBe(1499); // only the variant exists
  });
  it('has no ARPU without paying users', () => {
    expect(subscriptions([], prices)).toMatchObject({ mrrCents: 0, paying: 0, arpuCents: 0, trials: 0 });
  });
});

describe('trialConversion', () => {
  const ev = (user_id: string, name: string, created_at: string) => ({ user_id, name, created_at });
  it('is the share of trial starters with a purchase after the trial started', () => {
    const r = trialConversion([
      ev('a', 'trial_start', '2026-11-01'), ev('a', 'purchase', '2026-11-08'),
      ev('b', 'trial_start', '2026-11-02'),
      ev('c', 'purchase', '2026-11-03'), // paid without a trial: not part of this rate
      ev('d', 'purchase', '2026-10-30'), ev('d', 'trial_start', '2026-11-04'), // purchase before the trial does not count
    ]);
    expect(r).toEqual({ trials: 3, converted: 1, rate: 1 / 3 });
  });
  it('is null without trials and counts each user once', () => {
    expect(trialConversion([]).rate).toBeNull();
    expect(trialConversion([ev('a', 'trial_start', '2026-11-01'), ev('a', 'trial_start', '2026-11-02')]).trials).toBe(1);
  });
});

describe('monthlyChurn', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  it('is canceled this month over active now plus canceled this month', () => {
    const r = monthlyChurn([ent('pro', 'active'), ent('pro', 'active'), ent('pro', 'active'), ent('pro', 'canceled', null, '2026-11-12T00:00:00Z'), ent('pro', 'canceled', null, '2026-10-30T00:00:00Z')], now);
    expect(r).toEqual({ churned: 1, rate: 0.25 });
  });
  it('is null with no subscribers', () => {
    expect(monthlyChurn([], now).rate).toBeNull();
  });
});

describe('otherCosts and margin', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  it('counts one-off costs on their day and monthly ones in full for the month, with a daily share', () => {
    const c = otherCosts(
      [
        { amount_usd: 30, recurrence: 'monthly', incurred_on: '2026-09-01' }, // 1 per day in a 30-day month
        { amount_usd: 100, recurrence: 'once', incurred_on: '2026-11-25' },
        { amount_usd: 50, recurrence: 'once', incurred_on: '2026-11-03' },
        { amount_usd: 70, recurrence: 'once', incurred_on: '2026-10-25' }, // last month
        { amount_usd: 20, recurrence: 'monthly', incurred_on: '2026-12-01' }, // not started yet
      ],
      now,
    );
    expect(c).toEqual({ today: 101, month: 180 });
  });
  it('computes profit and margin as a share of net revenue', () => {
    expect(margin(200, 50)).toEqual({ profit: 150, pct: 0.75 });
    expect(margin(0, 20)).toEqual({ profit: -20, pct: null });
  });
  it('divides ad spend by trials only when there are trials', () => {
    expect(costPerTrial(100, 4)).toBe(25);
    expect(costPerTrial(100, 0)).toBeNull();
  });
});

describe('AI health', () => {
  it('classifies validator messages by what went wrong', () => {
    const cases: [string, string][] = [
      ['Day 1: "x" is not in the exercise library.', 'unknown_item'],
      ['Day 2: "r" is not in the recipe library.', 'unknown_item'],
      ['Day 1: "r" contains nuts.', 'allergen_or_diet'],
      ['Day 1: "r" does not fit a vegan diet.', 'allergen_or_diet'],
      ['Day 1: "x" is contraindicated (knee).', 'injury'],
      ['Day 1: "x" needs equipment the user does not have.', 'equipment'],
      ["Day 1: \"x\" is above the user's level.", 'level'],
      ['The plan has 4 training days; the user trains 3 days per week.', 'schedule'],
      ['Day 1: about 80 min, over the 60 min available.', 'session_length'],
      ['quadriceps gets 30 sets per week; the maximum is 20.', 'volume'],
      ['Too little volume: 10 sets per week in total.', 'volume'],
      ['Day 1: "x" has RPE 9; keep it at 7 or lower.', 'intensity'],
      ['Day 1: kcal is 1500, target is 2000 (±10%).', 'macro_target'],
      ['something else', 'other'],
    ];
    for (const [msg, type] of cases) expect(classifyValidationError(msg), msg).toBe(type);
  });
  it('counts failures by type across attempts, most common first', () => {
    const out = failureTypes([
      { outcome: 'validation_failed', errors: ['Day 1: "r" contains nuts.', 'Day 2: "r" contains soy.', 'Day 1: kcal is 1, target is 2 (±10%).'] },
      { outcome: 'qa_failed', errors: ['- safety: ...'] },
      { outcome: 'passed', errors: [] },
      { outcome: 'invalid_output', errors: [] },
      { outcome: 'http_error', errors: [] },
    ]);
    expect(out).toEqual([
      { type: 'allergen_or_diet', count: 2 }, { type: 'http_error', count: 1 }, { type: 'invalid_output', count: 1 }, { type: 'macro_target', count: 1 }, { type: 'qa_failed', count: 1 },
    ]);
  });
  it('turns daily rows into rates over finished generations', () => {
    const day = (o: Partial<GenerationDay>): GenerationDay => ({ jobs: 0, done: 0, failed: 0, users: 0, first_pass: 0, retried: 0, escalated: 0, fallback: 0, needs_review: 0, ...o });
    const s = generationSummary([day({ jobs: 6, done: 5, failed: 1, first_pass: 3, retried: 2, escalated: 1, fallback: 1 }), day({ jobs: 5, done: 5, first_pass: 5 })]);
    expect(s).toMatchObject({ jobs: 11, done: 10, firstPassRate: 0.8, retryRate: 0.2, escalationRate: 0.1, fallbackRate: 0.1 });
    expect(s.failRate).toBeCloseTo(1 / 11);
    expect(generationSummary([]).firstPassRate).toBeNull();
  });
});

describe('funnel', () => {
  it('lists all 13 onboarding screens with the share that stayed from the previous screen', () => {
    const d = screenDropOff([{ screen: 1, visitors: 100 }, { screen: 2, visitors: 80 }, { screen: 2, visitors: 0 }, { screen: 3, visitors: 40 }]);
    expect(d).toHaveLength(13);
    expect(d[0]).toEqual({ screen: 1, visitors: 100, stayed: null });
    expect(d[1]).toEqual({ screen: 2, visitors: 80, stayed: 0.8 });
    expect(d[2]).toEqual({ screen: 3, visitors: 40, stayed: 0.5 });
    expect(d[3]).toEqual({ screen: 4, visitors: 0, stayed: 0 });
    expect(d[4].stayed).toBeNull(); // nobody on screen 4: nothing to divide
  });
  it('offers the sources seen, busiest first, and always (direct)', () => {
    expect(sourceOptions([{ source: 'meta', visitors: 5 }, { source: 'google', visitors: 9 }, { source: 'meta', visitors: 1 }])).toEqual(['google', 'meta', '(direct)']);
    expect(sourceOptions([{ source: '(direct)', visitors: 1 }])).toEqual(['(direct)']);
    expect(sourceOptions([])).toEqual(['(direct)']);
  });
});
