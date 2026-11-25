import { WEEKDAYS } from '../onboarding/schema.ts';
import { WorkoutPlanSchema } from '../ai/schemas.ts';
import { trainingWeekdays, type Weekday } from '../plan/today.ts';
import { estimateSessionMinutes } from '../ai/validator.ts';

// Workout-day reminders: who gets one, and what it says. Pure, so the Edge Function stays thin.

/** Push copy stays short: the notification should be readable on a lock screen. */
export const MAX_REMINDER_LENGTH = 59;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * "Leg day, Ana. 45 min and you're done." (under 60 characters). The day name is shortened if needed;
 * the name is dropped if it is missing, and then the day name alone still fits.
 */
export function reminderMessage(args: { dayName: string; name?: string | null; minutes: number }): string {
  const tail = `${Math.max(1, Math.round(args.minutes))} min and you're done.`;
  const name = clean(args.name ?? '');
  const build = (day: string) => `${day}${name ? `, ${name}` : ''}. ${tail}`;
  let day = clean(args.dayName) || 'Workout day';
  let msg = build(day);
  if (msg.length <= MAX_REMINDER_LENGTH) return msg;
  // Drop a long first name before cutting the day name.
  const withoutName = `${day}. ${tail}`;
  if (withoutName.length <= MAX_REMINDER_LENGTH) return withoutName;
  const room = MAX_REMINDER_LENGTH - `. ${tail}`.length - 1;
  day = `${day.slice(0, Math.max(1, room)).trimEnd()}…`;
  msg = `${day}. ${tail}`;
  return msg.slice(0, MAX_REMINDER_LENGTH);
}

export interface ReminderDecision {
  send: boolean;
  /** Why not, for logs. */
  reason?: 'no_plan' | 'rest_day' | 'already_trained';
  message?: string;
}

/**
 * Decide for one user: is today a training day in their plan, and have they not trained yet?
 * `weekday` is the user's LOCAL weekday (from the token's time zone), `isoWeekday` 1 = Monday.
 */
export function decideReminder(args: {
  workoutResult: unknown;
  preferredDays?: readonly Weekday[];
  isoWeekday: number;
  trainedToday: boolean;
  name?: string | null;
}): ReminderDecision {
  const plan = WorkoutPlanSchema.safeParse((args.workoutResult as { plan?: unknown } | null | undefined)?.plan);
  if (!plan.success) return { send: false, reason: 'no_plan' };
  const today = WEEKDAYS[Math.min(7, Math.max(1, args.isoWeekday)) - 1];
  const schedule = trainingWeekdays(plan.data.days.length, args.preferredDays);
  const i = schedule.indexOf(today);
  if (i < 0) return { send: false, reason: 'rest_day' };
  if (args.trainedToday) return { send: false, reason: 'already_trained' };
  const day = plan.data.days[i];
  return { send: true, message: reminderMessage({ dayName: day.name, name: args.name, minutes: estimateSessionMinutes(day) }) };
}

// ---- Expo push API ----

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
export const EXPO_BATCH_SIZE = 100;
export const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,80}\]$/;

export interface PushMessage {
  to: string;
  body: string;
  sound: 'default';
  data: { url: string };
}

export const pushMessage = (token: string, body: string): PushMessage => ({ to: token, body, sound: 'default', data: { url: '/' } });

export function chunkMessages<T>(messages: readonly T[], size = EXPO_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < messages.length; i += size) out.push(messages.slice(i, i + size));
  return out;
}

export interface ExpoTicket {
  status?: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Tokens Expo says are dead (app uninstalled, token revoked): they are switched off so we stop sending.
 * `tickets` is the `data` array of the response, in the same order as the messages.
 */
export function deadTokens(messages: readonly Pick<PushMessage, 'to'>[], tickets: readonly ExpoTicket[]): string[] {
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t?.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i]) dead.push(messages[i].to);
  });
  return dead;
}

/** Calendar date (yyyy-mm-dd) of an instant in an IANA time zone: "did they train today, where they are?". */
export function localDateKey(at: Date | string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}
