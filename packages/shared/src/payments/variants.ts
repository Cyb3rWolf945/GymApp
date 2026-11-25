import { PRICES, type Interval, type PaidTier } from './pricing.ts';

// Prices shown on the paywall come from the `plan_prices` table, so a price (or an A/B variant) changes without a deploy.

export interface PlanPriceRow {
  lookup_key: string;
  tier: PaidTier;
  interval: Interval;
  cents: number;
  variant: string;
  stripe_price_id: string | null;
  active: boolean;
}

export const DEFAULT_VARIANT = 'default';

/** Stable 32-bit hash (FNV-1a): the same user always lands in the same variant. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * The price set this user sees. Only variants that cover every plan are eligible (a half-configured test never
 * reaches users); the user is assigned by hashing their id. Empty when no variant is complete.
 */
export function resolvePrices(rows: readonly PlanPriceRow[], userId: string): { variant: string; prices: PlanPriceRow[] } {
  const byVariant = new Map<string, PlanPriceRow[]>();
  for (const r of rows.filter((x) => x.active)) byVariant.set(r.variant, [...(byVariant.get(r.variant) ?? []), r]);
  const complete = [...byVariant.entries()]
    .filter(([, rs]) => PRICES.every((p) => rs.some((r) => r.lookup_key === p.lookupKey)))
    .map(([v]) => v)
    .sort();
  if (complete.length === 0) return { variant: DEFAULT_VARIANT, prices: [] };
  const variant = complete.length === 1 ? complete[0] : complete[hashString(userId) % complete.length];
  return { variant, prices: byVariant.get(variant)! };
}

/** The cheapest monthly price in a price set ("Plans from $X a month"), or null when there is none. */
export function lowestMonthlyCents(prices: readonly PlanPriceRow[]): number | null {
  const monthly = prices.filter((p) => p.active && p.interval === 'month').map((p) => p.cents);
  return monthly.length ? Math.min(...monthly) : null;
}

export const formatUsd = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/** Price per day for the paywall ("$0.82/day"): monthly over 30.4 days, annual over 365. */
export const perDayUsd = (cents: number, interval: Interval): string => formatUsd(cents / (interval === 'month' ? 30.4 : 365));

/** How much cheaper annual is than twelve months, in whole percent. */
export const annualSavingsPercent = (monthlyCents: number, annualCents: number): number => Math.round((1 - annualCents / (monthlyCents * 12)) * 100);
