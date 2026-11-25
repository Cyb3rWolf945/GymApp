import { describe, expect, it } from 'vitest';
import { hasAccess } from './entitlements.ts';
import { MONTHLY_GENERATION_QUOTA, decideGeneration, startOfMonthUtc } from './gating.ts';
import { FEATURES, FEATURE_MIN_TIER, PRICES, tierIncludes } from './pricing.ts';
import { type PlanPriceRow, annualSavingsPercent, formatUsd, perDayUsd, resolvePrices } from './variants.ts';

const now = new Date('2026-12-10T12:00:00Z');
const ent = (tier: 'basic' | 'pro' | 'elite', over: Record<string, unknown> = {}) => ({ tier, status: 'active', current_period_end: '2027-01-01T00:00:00Z', past_due_since: null, ...over });
const jobs = (n: number, status = 'done') => Array.from({ length: n }, () => ({ status }));

describe('feature matrix', () => {
  it('Basic = workouts and swaps; Pro adds nutrition, recipes, shopping, unlimited generation; Elite adds weekly adjust', () => {
    expect(FEATURES.filter((f) => tierIncludes('basic', f))).toEqual(['workouts', 'swaps']);
    expect(FEATURES.filter((f) => tierIncludes('pro', f))).toEqual(['workouts', 'swaps', 'nutrition', 'recipes', 'shopping', 'unlimited_generation']);
    expect(FEATURES.filter((f) => tierIncludes('elite', f))).toEqual([...FEATURES]);
    expect(tierIncludes('none', 'workouts')).toBe(false);
  });
  it('hasAccess agrees with the matrix for every tier and feature', () => {
    for (const tier of ['basic', 'pro', 'elite'] as const) {
      for (const f of FEATURES) expect(hasAccess(ent(tier), f, now), `${tier}/${f}`).toBe(tierIncludes(tier, f));
    }
    expect(FEATURE_MIN_TIER.weekly_adjust).toBe('elite');
  });
});

describe('decideGeneration', () => {
  it('gives free users one generation per kind, then needs_trial; failed jobs do not count', () => {
    expect(decideGeneration(null, 'workout_plan', [], [], now)).toEqual({ allow: true });
    expect(decideGeneration(null, 'workout_plan', jobs(1), jobs(1), now)).toEqual({ allow: false, reason: 'needs_trial' });
    expect(decideGeneration(null, 'workout_plan', jobs(3, 'failed'), [], now)).toEqual({ allow: true });
    expect(decideGeneration(null, 'nutrition_plan', [], jobs(1), now)).toEqual({ allow: true });
  });
  it('treats expired or past-grace entitlements as free users', () => {
    expect(decideGeneration(ent('pro', { current_period_end: '2026-12-01T00:00:00Z' }), 'workout_plan', jobs(1), [], now)).toEqual({ allow: false, reason: 'needs_trial' });
    expect(decideGeneration(ent('pro', { status: 'canceled' }), 'workout_plan', jobs(1), [], now)).toEqual({ allow: false, reason: 'needs_trial' });
  });
  it('Basic: workouts only, one per month', () => {
    expect(decideGeneration(ent('basic'), 'workout_plan', jobs(1), [], now)).toEqual({ allow: true });
    expect(decideGeneration(ent('basic'), 'workout_plan', jobs(1), jobs(1), now)).toEqual({ allow: false, reason: 'quota' });
    expect(decideGeneration(ent('basic'), 'nutrition_plan', [], [], now)).toEqual({ allow: false, reason: 'upgrade' });
  });
  it('Pro and Elite: fair-use cap per month', () => {
    expect(decideGeneration(ent('pro'), 'nutrition_plan', jobs(5), jobs(MONTHLY_GENERATION_QUOTA.pro - 1), now)).toEqual({ allow: true });
    expect(decideGeneration(ent('pro'), 'nutrition_plan', jobs(5), jobs(MONTHLY_GENERATION_QUOTA.pro), now)).toEqual({ allow: false, reason: 'quota' });
    expect(decideGeneration(ent('elite'), 'workout_plan', [], jobs(MONTHLY_GENERATION_QUOTA.pro), now)).toEqual({ allow: true });
    expect(decideGeneration(ent('pro'), 'workout_plan', [], [...jobs(MONTHLY_GENERATION_QUOTA.pro, 'failed')], now)).toEqual({ allow: true });
  });
  it('starts the month at 00:00 UTC on the 1st', () => {
    expect(startOfMonthUtc(now)).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('price variants', () => {
  const set = (variant: string, mult = 1, skip?: string): PlanPriceRow[] =>
    PRICES.filter((p) => p.lookupKey !== skip).map((p) => ({ lookup_key: p.lookupKey, tier: p.tier, interval: p.interval, cents: Math.round(p.cents * mult), variant, stripe_price_id: null, active: true }));

  it('uses the only complete variant', () => {
    expect(resolvePrices(set('default'), 'u1').variant).toBe('default');
  });
  it('ignores incomplete and inactive variants', () => {
    const rows = [...set('default'), ...set('test', 1.5, 'elite_annual'), ...set('off').map((r) => ({ ...r, active: false }))];
    expect(resolvePrices(rows, 'u1').variant).toBe('default');
  });
  it('assigns users to variants deterministically and splits roughly evenly', () => {
    const rows = [...set('a'), ...set('b', 1.25)];
    expect(resolvePrices(rows, 'user-1')).toEqual(resolvePrices(rows, 'user-1'));
    const counts = { a: 0, b: 0 } as Record<string, number>;
    for (let i = 0; i < 1000; i++) counts[resolvePrices(rows, `user-${i}`).variant]++;
    expect(counts.a).toBeGreaterThan(400);
    expect(counts.b).toBeGreaterThan(400);
  });
  it('returns no prices when nothing is configured', () => {
    expect(resolvePrices([], 'u1').prices).toEqual([]);
  });
});

describe('price display', () => {
  it('formats prices, per-day cost and annual savings', () => {
    expect(formatUsd(2499)).toBe('$24.99');
    expect(perDayUsd(2499, 'month')).toBe('$0.82');
    expect(perDayUsd(14999, 'year')).toBe('$0.41');
    expect(annualSavingsPercent(1999, 11999)).toBe(50);
    expect(annualSavingsPercent(999, 5999)).toBe(50);
  });
});
