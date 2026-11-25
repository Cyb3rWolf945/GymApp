import { z } from 'zod';
import type { StepId } from './flow.ts';

// Funnel events for onboarding. The `track-event` Edge Function accepts only these names.

export const ONBOARDING_EVENTS = ['onboarding_step_viewed', 'onboarding_step_completed', 'onboarding_step_skipped', 'onboarding_finished'] as const;
export type OnboardingEventName = (typeof ONBOARDING_EVENTS)[number];

export const TrackEventSchema = z.object({
  anonId: z.string().min(8).max(64),
  name: z.enum(ONBOARDING_EVENTS),
  props: z.record(z.string().max(40), z.union([z.string().max(60), z.number(), z.boolean()])).default({}),
});
export type TrackEvent = z.infer<typeof TrackEventSchema>;

/** Props never carry answers (health data): only where the user is in the funnel. */
export function stepEvent(name: OnboardingEventName, step: StepId, screen: number, version: number) {
  return { name, props: { step, screen, version } };
}
