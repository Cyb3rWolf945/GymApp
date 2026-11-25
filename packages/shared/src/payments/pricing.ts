// Single source of truth for the subscription catalogue (USD, test mode first). Used by the Stripe setup script
// and by the checkout function, which resolves prices by `lookup_key`.

export const PAID_TIERS = ['basic', 'pro', 'elite'] as const;
export type PaidTier = (typeof PAID_TIERS)[number];
export type Tier = 'none' | PaidTier;
export type Interval = 'month' | 'year';

export const TRIAL_DAYS = 7;

export interface PriceSpec {
  lookupKey: string;
  tier: PaidTier;
  interval: Interval;
  cents: number;
  /** The 7-day trial is for annual plans only. */
  trialDays: number;
}

const p = (tier: PaidTier, interval: Interval, cents: number): PriceSpec => ({
  lookupKey: `${tier}_${interval === 'month' ? 'monthly' : 'annual'}`,
  tier,
  interval,
  cents,
  trialDays: interval === 'year' ? TRIAL_DAYS : 0,
});

export const PRICES: readonly PriceSpec[] = [
  p('basic', 'month', 999), p('basic', 'year', 5999),
  p('pro', 'month', 1999), p('pro', 'year', 11999),
  p('elite', 'month', 2499), p('elite', 'year', 14999),
];

/** "FOUNDING": Pro annual at $79.99 for the first year, i.e. $40.00 off once. */
export const FOUNDING_COUPON = { id: 'FOUNDING', tier: 'pro' as PaidTier, lookupKey: 'pro_annual', amountOffCents: 4000 };

export const priceByKey = (key: string): PriceSpec | undefined => PRICES.find((x) => x.lookupKey === key);
export const tierOfLookupKey = (key: string | null | undefined): Tier => (key ? (priceByKey(key)?.tier ?? 'none') : 'none');

// Feature matrix (SPEC §6), enforced server-side. Keep `FEATURE_MIN_TIER` and the SQL `has_access` in sync.
export const FEATURES = ['workouts', 'swaps', 'nutrition', 'recipes', 'shopping', 'unlimited_generation', 'weekly_adjust'] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_MIN_TIER: Record<Feature, Exclude<Tier, 'none'>> = {
  workouts: 'basic',
  swaps: 'basic',
  nutrition: 'pro',
  recipes: 'pro',
  shopping: 'pro',
  unlimited_generation: 'pro',
  weekly_adjust: 'elite',
};

const RANK: Record<Tier, number> = { none: 0, basic: 1, pro: 2, elite: 3 };
export const tierIncludes = (tier: Tier, feature: Feature): boolean => RANK[tier] >= RANK[FEATURE_MIN_TIER[feature]];

