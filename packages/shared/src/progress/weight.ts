// Body weight: parsing what the user types and the 7-day moving average for the trend chart.

export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;

/** "80", "80.5" or "80,5" -> kg with 1 decimal. Null when it is not a believable body weight. */
export function parseWeightKg(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < MIN_WEIGHT_KG || n > MAX_WEIGHT_KG) return null;
  return Math.round(n * 10) / 10;
}

export interface WeightPoint {
  /** YYYY-MM-DD. */
  date: string;
  kg: number;
}
export interface WeightTrendPoint extends WeightPoint {
  /** Mean of the readings in the 7 calendar days ending on this date (inclusive), 1 decimal. */
  avg: number;
}

const DAY = 86_400_000;
const day = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);

/**
 * 7-day moving average over calendar days, not over the last 7 readings: people weigh in on irregular days, and
 * a gap should not stretch the window. Points are returned oldest first.
 */
export function weightTrend(points: readonly WeightPoint[], windowDays = 7): WeightTrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const end = day(p.date);
    const inWindow = sorted.filter((q) => day(q.date) <= end && day(q.date) > end - windowDays);
    const avg = inWindow.reduce((t, q) => t + q.kg, 0) / inWindow.length;
    return { ...p, avg: Math.round(avg * 10) / 10 };
  });
}

/** Change of the moving average between the first and last point, kg (1 decimal). Null with fewer than 2 readings. */
export function trendChange(trend: readonly WeightTrendPoint[]): number | null {
  if (trend.length < 2) return null;
  return Math.round((trend[trend.length - 1].avg - trend[0].avg) * 10) / 10;
}
