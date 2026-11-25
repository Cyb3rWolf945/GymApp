// Pure helpers for the Engagement screen: shaping the SQL aggregates into numbers worth showing.

export interface DailyRow {
  day: string;
  dau: number;
  wau: number;
  workouts: number;
}
export interface CohortRow {
  cohort: string;
  size: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

/** Share of a cohort that came back (0..1). null while that day has not been reached, 0 for an empty cohort. */
export function retentionRate(count: number | null, size: number): number | null {
  if (count === null) return null;
  return size > 0 ? count / size : 0;
}

export interface EngagementSummary {
  /** Active users today and in the trailing 7 days. */
  dau: number;
  wau: number;
  /** DAU ÷ WAU: how many of the weekly users show up on a given day (0..1), null without WAU. */
  stickiness: number | null;
  /** Average finished workouts per day over the period. */
  workoutsPerDay: number;
}

export function summarizeEngagement(rows: readonly DailyRow[]): EngagementSummary {
  const last = rows[rows.length - 1];
  const total = rows.reduce((t, r) => t + r.workouts, 0);
  return {
    dau: last?.dau ?? 0,
    wau: last?.wau ?? 0,
    stickiness: last && last.wau > 0 ? last.dau / last.wau : null,
    workoutsPerDay: rows.length > 0 ? Math.round((total / rows.length) * 10) / 10 : 0,
  };
}

export interface RetentionTotals {
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

/** Retention over all cohorts old enough for that day (weighted by cohort size, so tiny cohorts do not skew it). */
export function overallRetention(rows: readonly CohortRow[]): RetentionTotals {
  const calc = (pick: (r: CohortRow) => number | null): number | null => {
    let kept = 0;
    let size = 0;
    for (const r of rows) {
      const v = pick(r);
      if (v === null) continue;
      kept += v;
      size += r.size;
    }
    return size > 0 ? kept / size : null;
  };
  return { d1: calc((r) => r.d1), d7: calc((r) => r.d7), d30: calc((r) => r.d30) };
}

export const adherenceLabel = (avgPct: number | null, users: number): string =>
  avgPct === null || users === 0 ? '–' : `${Math.round(avgPct)}% (${users} users)`;
