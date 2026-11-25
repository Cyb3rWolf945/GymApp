// KPI maths for the Overview, Funnel and AI health screens. Pure, so the numbers are unit-tested.
// Approximations are stated next to each function: nothing here claims more precision than the data has.

export const TIERS = ['basic', 'pro', 'elite'] as const;
export type PaidTier = (typeof TIERS)[number];

export interface EntitlementRow {
  tier: string;
  status: string;
  price_key: string | null;
  updated_at: string;
}
export interface PriceRow {
  lookup_key: string;
  tier: string;
  interval: string;
  cents: number;
  variant: string;
}

const DEFAULT_VARIANT = 'default';

/** The list price for a plan key. Prefers the default variant. A/B variants and coupons are not reflected. */
function priceFor(key: string, prices: readonly PriceRow[]): PriceRow | undefined {
  const matches = prices.filter((p) => p.lookup_key === key);
  return matches.find((p) => p.variant === DEFAULT_VARIANT) ?? matches[0];
}

/** Monthly equivalent in cents: monthly price as is, annual divided by 12. */
const monthlyEquivalent = (p: PriceRow): number => (p.interval === 'year' ? p.cents / 12 : p.cents);

export interface Subscriptions {
  /** Monthly recurring revenue in cents from paying (status active) subscribers. Trials are not paying yet. */
  mrrCents: number;
  byTier: Record<PaidTier, { subs: number; mrrCents: number }>;
  /** Paying subscribers. */
  paying: number;
  trials: number;
  /** MRR per paying subscriber, cents. */
  arpuCents: number;
}

/**
 * MRR and subscriber counts from `entitlements`. Rows without a price key (before the key was stored) are counted at the
 * tier's monthly list price. Past-due subscribers still count as paying while they are in their grace period.
 */
export function subscriptions(rows: readonly EntitlementRow[], prices: readonly PriceRow[]): Subscriptions {
  const byTier = Object.fromEntries(TIERS.map((t) => [t, { subs: 0, mrrCents: 0 }])) as Subscriptions['byTier'];
  let trials = 0;
  for (const r of rows) {
    if (!(TIERS as readonly string[]).includes(r.tier)) continue;
    if (r.status === 'trialing') trials += 1;
    if (r.status !== 'active' && r.status !== 'past_due') continue;
    const price = priceFor(r.price_key ?? `${r.tier}_monthly`, prices);
    const tier = r.tier as PaidTier;
    byTier[tier].subs += 1;
    byTier[tier].mrrCents += price ? monthlyEquivalent(price) : 0;
  }
  const paying = TIERS.reduce((n, t) => n + byTier[t].subs, 0);
  const mrrCents = Math.round(TIERS.reduce((n, t) => n + byTier[t].mrrCents, 0));
  for (const t of TIERS) byTier[t].mrrCents = Math.round(byTier[t].mrrCents);
  return { mrrCents, byTier, paying, trials, arpuCents: paying > 0 ? Math.round(mrrCents / paying) : 0 };
}

export interface EventRow {
  user_id: string | null;
  name: string;
  created_at: string;
}

/**
 * Trial to paid: of the users who started a trial, the share with a purchase (a paid invoice) after it.
 * Null when nobody started a trial. Recent trials that have not reached their first invoice yet pull the rate down,
 * so read it over a period whose trials have all ended (7 days or more ago).
 */
export function trialConversion(events: readonly EventRow[]): { trials: number; converted: number; rate: number | null } {
  const trialStart = new Map<string, string>();
  for (const e of events) if (e.name === 'trial_start' && e.user_id && !trialStart.has(e.user_id)) trialStart.set(e.user_id, e.created_at);
  let converted = 0;
  for (const [user, at] of trialStart) {
    if (events.some((e) => e.name === 'purchase' && e.user_id === user && e.created_at > at)) converted += 1;
  }
  return { trials: trialStart.size, converted, rate: trialStart.size > 0 ? converted / trialStart.size : null };
}

/**
 * Churn this month: subscriptions that ended this month over those paying now plus those that ended.
 * Approximation (the table keeps the latest state, not a history): a subscription that ended and came back counts as active.
 */
export function monthlyChurn(rows: readonly EntitlementRow[], now = new Date()): { churned: number; rate: number | null } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const churned = rows.filter((r) => r.status === 'canceled' && r.updated_at >= monthStart).length;
  const active = rows.filter((r) => r.status === 'active' || r.status === 'past_due').length;
  const base = active + churned;
  return { churned, rate: base > 0 ? churned / base : null };
}

export interface CostEntry {
  amount_usd: number;
  recurrence: string;
  incurred_on: string;
}

/**
 * Other costs (hosting, tools...) in USD for a period. A one-off cost counts on its day. A monthly cost counts in full
 * for every month it has started in, and one day's share is 1/days-in-month of it.
 */
export function otherCosts(entries: readonly CostEntry[], now = new Date()): { today: number; month: number } {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  let today = 0;
  let monthly = 0;
  for (const e of entries) {
    const amount = Number(e.amount_usd);
    if (e.recurrence === 'monthly') {
      if (e.incurred_on.slice(0, 7) <= month) {
        monthly += amount;
        today += amount / daysInMonth;
      }
    } else {
      if (e.incurred_on.slice(0, 7) === month) monthly += amount;
      if (e.incurred_on === day) today += amount;
    }
  }
  return { today: Math.round(today * 100) / 100, month: Math.round(monthly * 100) / 100 };
}

/** Net revenue minus all costs. Margin is a share of net revenue, null with no revenue. */
export function margin(netUsd: number, costUsd: number): { profit: number; pct: number | null } {
  const profit = Math.round((netUsd - costUsd) * 100) / 100;
  return { profit, pct: netUsd > 0 ? profit / netUsd : null };
}

/** Ad spend per trial. Null without trials. */
export const costPerTrial = (spendUsd: number, trials: number): number | null => (trials > 0 ? spendUsd / trials : null);

export const rate = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

// ---------- AI health

export const VALIDATION_TYPES = ['unknown_item', 'allergen_or_diet', 'injury', 'equipment', 'level', 'schedule', 'session_length', 'volume', 'intensity', 'macro_target', 'other'] as const;
export type ValidationType = (typeof VALIDATION_TYPES)[number];

/** Group a validator message (see `validator.ts`) by what went wrong. The messages hold slugs, never user text. */
export function classifyValidationError(message: string): ValidationType {
  const m = message;
  if (/is not in the (exercise|recipe) library/.test(m)) return 'unknown_item';
  if (/ contains |does not fit a .* diet/.test(m)) return 'allergen_or_diet';
  if (/contraindicated/.test(m)) return 'injury';
  if (/needs equipment/.test(m)) return 'equipment';
  if (/above the user's level/.test(m)) return 'level';
  if (/training days/.test(m)) return 'schedule';
  if (/about \d+ min, over/.test(m)) return 'session_length';
  if (/sets per week|Too little volume/.test(m)) return 'volume';
  if (/RPE|repsMin/.test(m)) return 'intensity';
  if (/target is/.test(m)) return 'macro_target';
  return 'other';
}

export interface AttemptRow {
  outcome: string;
  errors: string[];
}

/** Failures by type: each validator message by its kind, plus the other ways an attempt can fail. */
export function failureTypes(attempts: readonly AttemptRow[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const a of attempts) {
    if (a.outcome === 'validation_failed') for (const e of a.errors) bump(classifyValidationError(e));
    else if (a.outcome === 'qa_failed') bump('qa_failed');
    else if (a.outcome === 'invalid_output') bump('invalid_output');
    else if (a.outcome === 'http_error') bump('http_error');
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export interface GenerationDay {
  jobs: number;
  done: number;
  failed: number;
  users: number;
  first_pass: number;
  retried: number;
  escalated: number;
  fallback: number;
  needs_review: number;
}

/** Totals over days, and the rates the AI health screen shows. Rates are over finished (done) generations. */
export function generationSummary(days: readonly GenerationDay[]) {
  const t = days.reduce(
    (a, d) => ({ jobs: a.jobs + d.jobs, done: a.done + d.done, failed: a.failed + d.failed, first_pass: a.first_pass + d.first_pass, retried: a.retried + d.retried, escalated: a.escalated + d.escalated, fallback: a.fallback + d.fallback, needs_review: a.needs_review + d.needs_review }),
    { jobs: 0, done: 0, failed: 0, first_pass: 0, retried: 0, escalated: 0, fallback: 0, needs_review: 0 },
  );
  return { ...t, firstPassRate: rate(t.first_pass, t.done), retryRate: rate(t.retried, t.done), escalationRate: rate(t.escalated, t.done), fallbackRate: rate(t.fallback, t.done), failRate: rate(t.failed, t.jobs) };
}

// ---------- Funnel

export const ONBOARDING_SCREENS = Array.from({ length: 13 }, (_, i) => i + 1);

/** Visitors per onboarding screen 1-13 with the share that stayed from the previous screen (drop-off = 1 - stayed). */
export function screenDropOff(rows: readonly { screen: number; visitors: number }[]): { screen: number; visitors: number; stayed: number | null }[] {
  const totals = new Map<number, number>();
  for (const r of rows) totals.set(r.screen, (totals.get(r.screen) ?? 0) + r.visitors);
  return ONBOARDING_SCREENS.map((screen) => {
    const visitors = totals.get(screen) ?? 0;
    const prev = screen === 1 ? null : (totals.get(screen - 1) ?? 0);
    return { screen, visitors, stayed: prev === null ? null : rate(visitors, prev) };
  });
}

/** The sources to offer in the filter: those seen in the data, most visitors first, "(direct)" always available. */
export function sourceOptions(rows: readonly { source: string; visitors: number }[]): string[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.source, (totals.get(r.source) ?? 0) + r.visitors);
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
  return sorted.includes('(direct)') ? sorted : [...sorted, '(direct)'];
}
