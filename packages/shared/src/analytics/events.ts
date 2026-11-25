import { z } from 'zod';
import { ONBOARDING_EVENTS } from '../onboarding/analytics.ts';

// The analytics event catalogue. One place defines every event name and its props, so `track()` is typed on the
// app and on the server, and the `track-event` Edge Function validates the same schemas.
// Props never carry answers or free text (health data): only ids, counts and enums. Unknown props are rejected.

const onboardingProps = z.object({ step: z.string().max(40), screen: z.number().int(), version: z.number().int() }).strict();
const tierProp = z.enum(['basic', 'pro', 'elite']);

const utm = z.string().max(80).optional();

export const EVENT_PROPS = {
  landing_view: z.object({ utm_source: utm, utm_medium: utm, utm_campaign: utm, utm_content: utm, utm_term: utm }).strict(),
  quiz_start: z.object({}).strict(),
  quiz_complete: z.object({}).strict(),
  signup: z.object({ method: z.enum(['apple', 'google', 'email', 'other']) }).strict(),
  onboarding_step_viewed: onboardingProps,
  onboarding_step_completed: onboardingProps,
  onboarding_step_skipped: onboardingProps,
  onboarding_finished: onboardingProps,
  account_modal_view: z.object({}).strict(),
  signin_method_chosen: z.object({ method: z.enum(['password', 'email_code', 'google', 'apple']) }).strict(),
  plan_preview_view: z.object({}).strict(),
  paywall_view: z.object({ variant: z.string().max(40).optional() }).strict(),
  checkout_start: z.object({ price_key: z.string().max(40), variant: z.string().max(40).optional() }).strict(),
  trial_start: z.object({ tier: tierProp }).strict(),
  purchase: z.object({ tier: tierProp, interval: z.enum(['month', 'year']), amount_usd: z.number().min(0), reason: z.string().max(40) }).strict(),
  workout_logged: z.object({ sets: z.number().int().min(0), minutes: z.number().int().min(0) }).strict(),
} as const;

export type AnalyticsEventName = keyof typeof EVENT_PROPS;
export type EventProps<N extends AnalyticsEventName> = z.infer<(typeof EVENT_PROPS)[N]>;

/** Events a browser or app may send through `track-event`. Everything else is written by the server only. */
export const CLIENT_EVENTS = [
  'landing_view', 'quiz_start', 'quiz_complete', ...ONBOARDING_EVENTS, 'account_modal_view', 'signin_method_chosen', 'plan_preview_view', 'paywall_view', 'checkout_start', 'workout_logged',
] as const satisfies readonly AnalyticsEventName[];
/** Money and identity events: written by webhooks and database triggers, so they can't be forged. */
export const SERVER_EVENTS = ['signup', 'trial_start', 'purchase'] as const satisfies readonly AnalyticsEventName[];

export const EVENT_NAMES = Object.keys(EVENT_PROPS) as AnalyticsEventName[];

/** The body of a `track-event` call. */
export const ClientTrackSchema = z
  .object({
    anonId: z.string().min(8).max(64),
    name: z.enum(CLIENT_EVENTS),
    props: z.record(z.string(), z.unknown()).default({}),
    /** Only sent when the visitor accepted tracking: ids Meta needs to match a server-side Lead to the Pixel. */
    marketing: z.object({ fbp: z.string().max(200).optional(), fbc: z.string().max(200).optional() }).strict().optional(),
  })
  .transform((v, ctx) => {
    const props = EVENT_PROPS[v.name].safeParse(v.props);
    if (!props.success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid props for this event.' });
      return z.NEVER;
    }
    return { anonId: v.anonId, name: v.name, props: props.data as Record<string, string | number | boolean>, marketing: v.marketing };
  });

export interface AnalyticsRow {
  user_id: string | null;
  anon_id: string | null;
  name: AnalyticsEventName;
  props: Record<string, unknown>;
}
export type AnalyticsSink = (row: AnalyticsRow) => Promise<unknown> | unknown;

/**
 * Typed `track(event, props)`: the same helper for the app (sink = `track-event` call) and the server
 * (sink = insert into `analytics_events`). Props are checked at compile time and validated at runtime.
 */
export async function track<N extends AnalyticsEventName>(
  sink: AnalyticsSink,
  who: { userId?: string | null; anonId?: string | null },
  name: N,
  props: EventProps<N>,
): Promise<void> {
  const parsed = EVENT_PROPS[name].parse(props);
  await sink({ user_id: who.userId ?? null, anon_id: who.anonId ?? null, name, props: parsed });
}
