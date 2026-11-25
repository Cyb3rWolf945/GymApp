// Pure helpers for the dashboards, so the numbers are unit-tested.

export const FUNNEL_STEPS = [
  'quiz_start', 'quiz_complete', 'signup', 'onboarding_finished', 'plan_preview_view', 'paywall_view', 'checkout_start', 'trial_start', 'purchase',
] as const;

export interface FunnelRow {
  name: string;
  visitors: number;
}
export interface FunnelStep {
  name: string;
  visitors: number;
  /** Share of the previous step that reached this one (0..1), null for the first step. */
  conversion: number | null;
}

/** Visitors per funnel step (sum of daily visitors over the period) and the step-to-step conversion. */
export function funnelSteps(rows: readonly FunnelRow[]): FunnelStep[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.name, (totals.get(r.name) ?? 0) + r.visitors);
  return FUNNEL_STEPS.map((name, i) => {
    const visitors = totals.get(name) ?? 0;
    const prev = i === 0 ? null : (totals.get(FUNNEL_STEPS[i - 1]) ?? 0);
    return { name, visitors, conversion: prev === null ? null : prev > 0 ? visitors / prev : 0 };
  });
}

export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);

/** Date `days` ago as YYYY-MM-DD (UTC), for `day >= …` filters on the daily views. */
export const daysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
