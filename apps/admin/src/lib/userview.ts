// What the user detail page shows about plans, generations and adherence. Pure and tested.

export interface JobRow {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  needs_review: boolean | null;
  result: unknown;
}

interface Result {
  source?: string;
  attempts?: { outcome?: string }[];
  qa?: { criteria?: { score?: number; pass?: boolean }[] } | null;
  plan?: { days?: { name?: string; dayType?: string; kcal?: number; exercises?: unknown[]; meals?: unknown[] }[]; split?: string };
}

const res = (j: JobRow) => (j.result && typeof j.result === 'object' ? (j.result as Result) : {});

export interface GenerationLine {
  id: string;
  kind: string;
  status: string;
  at: string;
  source: string;
  attempts: number;
  /** Lowest and average QA score (1-5) of the accepted plan, null when QA did not run or the template was used. */
  qaMin: number | null;
  qaAvg: number | null;
  needsReview: boolean;
}

/** One line per generation job: who made the plan, how many attempts, and the QA scores. */
export function generationHistory(jobs: readonly JobRow[]): GenerationLine[] {
  return jobs.map((j) => {
    const r = res(j);
    const scores = (r.qa?.criteria ?? []).map((c) => c.score).filter((s): s is number => typeof s === 'number');
    return {
      id: j.id,
      kind: j.kind,
      status: j.status,
      at: j.created_at,
      source: r.source ?? (j.status === 'done' ? 'unknown' : '–'),
      attempts: r.attempts?.length ?? 0,
      qaMin: scores.length ? Math.min(...scores) : null,
      qaAvg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      needsReview: !!j.needs_review,
    };
  });
}

/** The current plan: the newest finished job of each kind. */
export function currentPlan(jobs: readonly JobRow[]) {
  const latest = (kind: string) => [...jobs].filter((j) => j.kind === kind && j.status === 'done').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const w = latest('workout_plan');
  const n = latest('nutrition_plan');
  const wd = w ? res(w).plan?.days ?? [] : [];
  const nd = n ? res(n).plan?.days ?? [] : [];
  return {
    workout: w ? { split: res(w).plan?.split ?? 'unknown', days: wd.map((d) => ({ name: d.name ?? 'Workout', exercises: d.exercises?.length ?? 0 })), at: w.created_at } : null,
    nutrition: n ? { days: nd.map((d) => ({ dayType: d.dayType ?? 'day', kcal: d.kcal ?? 0, meals: d.meals?.length ?? 0 })), at: n.created_at } : null,
  };
}

/**
 * Adherence over the last 4 weeks: finished workouts against planned ones (days per week x 4), capped at 100%.
 * Null when there is no workout plan to measure against.
 */
export function adherence(sessionDates: readonly string[], plannedPerWeek: number, now = new Date()): { done: number; planned: number; rate: number | null } {
  const since = now.getTime() - 28 * 86_400_000;
  const done = sessionDates.filter((d) => Date.parse(d) > since && Date.parse(d) <= now.getTime()).length;
  const planned = plannedPerWeek * 4;
  return { done, planned, rate: planned > 0 ? Math.min(1, done / planned) : null };
}

/** Link to the customer in the Stripe dashboard (`base` is `https://dashboard.stripe.com` or `.../test`). */
export const stripeCustomerUrl = (customerId: string | null | undefined, base = 'https://dashboard.stripe.com'): string | null =>
  customerId && /^cus_[A-Za-z0-9]+$/.test(customerId) ? `${base.replace(/\/+$/, '')}/customers/${customerId}` : null;

export const GUARDRAIL_LABELS: Record<string, string> = {
  injection: 'Prompt injection',
  off_topic: 'Off topic',
  medical_red_flag: 'Medical red flag',
  too_long: 'Too long',
  unclassified: 'Could not classify',
};
export const ACTION_LABELS: Record<string, string> = {
  blocked: 'Blocked',
  dropped: 'Dropped',
  blocked_unclassified: 'Blocked (unclassified)',
  truncated: 'Shortened',
  conservative_mode: 'Gentle plan mode',
};
