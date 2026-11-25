import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AnalyticsEventName, type EventProps, type OnboardingEventName, type StepId, ONBOARDING_STEPS, ONBOARDING_VERSION, getStep, stepEvent } from '@gymapp/shared';
import { dedupId } from '@gymapp/shared';
import { marketingIds, pixelTrack } from '../marketing/tracking';
import { isSupabaseConfigured, supabase } from '../supabase';

const ANON_KEY = 'fuelift.anon_id';
let anonId: string | null = null;

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

/** A random id that lives on the device, so funnel steps before sign-up belong to one visitor. */
export async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    anonId = await AsyncStorage.getItem(ANON_KEY);
    if (!anonId) {
      anonId = randomId();
      await AsyncStorage.setItem(ANON_KEY, anonId);
    }
  } catch {
    anonId ??= randomId();
  }
  return anonId;
}

/** Typed, fire and forget: analytics must never block or break the flow. Money and identity events are server-only. */
export function trackEvent<N extends Exclude<AnalyticsEventName, 'signup' | 'trial_start' | 'purchase'>>(name: N, props: EventProps<N>): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const anon = await getAnonId();
      // Quiz done = Lead. Meta gets it from the browser (Pixel) and from the server, with the same event id so it
      // counts once. Both only happen if the visitor accepted tracking.
      const marketing = name === 'quiz_complete' ? await marketingIds() : null;
      if (name === 'quiz_complete') void pixelTrack('Lead', dedupId.lead(anon));
      await supabase.functions.invoke('track-event', { body: { anonId: anon, name, props, ...(marketing ? { marketing } : {}) } });
    } catch {
      /* ignore */
    }
  })();
}

export function trackOnboarding(name: OnboardingEventName, step: StepId): void {
  const evt = stepEvent(name, step, getStep(step).screen, ONBOARDING_VERSION);
  trackEvent(evt.name, evt.props);
  // The quiz is the onboarding: it starts on the first screen and completes when onboarding finishes.
  if (name === 'onboarding_step_viewed' && step === ONBOARDING_STEPS[0].id) trackEvent('quiz_start', {});
  if (name === 'onboarding_finished') trackEvent('quiz_complete', {});
}
