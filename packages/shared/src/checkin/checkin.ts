import { z } from 'zod';
import { FREE_TEXT_MAX } from '../ai/guardrails.ts';
import { WEEKDAYS } from '../onboarding/schema.ts';
import type { Weekday } from '../plan/today.ts';

// E-53: the weekly check-in. Pure rules: which week is it, is a check-in due, what may be submitted.

const p2 = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
/** Monday-first index of a local date: 0 = Monday … 6 = Sunday. */
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** The Monday of the (local) week of `d`, as `YYYY-MM-DD`. Check-ins are one per user per week. */
export function weekStartKey(d: Date): string {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekdayIndex(d));
  return key(m);
}

export interface DueArgs {
  today: Date;
  /** The user's training weekdays (first one is when the check-in shows). Empty or unknown: Monday. */
  trainingDays?: readonly Weekday[];
  /** `week_start` of the newest check-in already sent, if any. */
  lastCheckinWeek?: string | null;
  /** `week_start` of the week whose card the user dismissed, if any. */
  dismissedWeek?: string | null;
}

/** First weekday of the week the user trains on, or Monday. */
export function checkinDay(trainingDays: readonly Weekday[] = []): Weekday {
  return WEEKDAYS.find((d) => trainingDays.includes(d)) ?? 'mon';
}

/** Show the card once a week, from the user's first workout day (or Monday) until it is sent or dismissed. */
export function isCheckinDue({ today, trainingDays, lastCheckinWeek, dismissedWeek }: DueArgs): boolean {
  const week = weekStartKey(today);
  if (lastCheckinWeek === week || dismissedWeek === week) return false;
  return weekdayIndex(today) >= WEEKDAYS.indexOf(checkinDay(trainingDays));
}

export const CHECKIN_LIMITS = {
  weightKg: { min: 20, max: 400 },
  scale: { min: 1, max: 5 },
  workouts: { min: 0, max: 14 },
  note: FREE_TEXT_MAX,
} as const;

/** What the app sends to the `weekly-checkin` function. The note is free text: the function filters it. */
export const CheckinInputSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().gt(CHECKIN_LIMITS.weightKg.min).lt(CHECKIN_LIMITS.weightKg.max).optional(),
  energy: z.number().int().min(1).max(5),
  sleep: z.number().int().min(1).max(5),
  workoutsDone: z.number().int().min(CHECKIN_LIMITS.workouts.min).max(CHECKIN_LIMITS.workouts.max),
  workoutsPlanned: z.number().int().min(0).max(CHECKIN_LIMITS.workouts.max).default(0),
  note: z.string().max(CHECKIN_LIMITS.note).optional(),
});
export type CheckinInput = z.infer<typeof CheckinInputSchema>;

/** The week must be this week's Monday (a client cannot file a check-in for another week). */
export function isCurrentWeek(weekStart: string, now: Date, slackDays = 1): boolean {
  const a = Date.parse(`${weekStart}T00:00:00Z`);
  const b = Date.parse(`${weekStartKey(now)}T00:00:00Z`);
  return Number.isFinite(a) && Math.abs(a - b) <= slackDays * 86_400_000 && new Date(a).getUTCDay() === 1;
}

/** Planned workouts per week, as stored on the check-in. */
export const plannedThisWeek = (trainingDays: readonly Weekday[]): number => trainingDays.length;

/** Workouts finished from `weekStart` on (local week), for the prefilled "how many did you do". */
export function workoutsDoneInWeek(finishedAt: readonly (string | Date)[], weekStart: string): number {
  const from = new Date(`${weekStart}T00:00:00`).getTime();
  return finishedAt.filter((f) => new Date(f).getTime() >= from).length;
}
