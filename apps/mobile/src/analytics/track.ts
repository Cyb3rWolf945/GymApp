import AsyncStorage from '@react-native-async-storage/async-storage';
import { type OnboardingEventName, type StepId, ONBOARDING_VERSION, getStep, stepEvent } from '@gymapp/shared';
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

/** Fire and forget: analytics must never block or break the flow. */
export function trackOnboarding(name: OnboardingEventName, step: StepId): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const evt = stepEvent(name, step, getStep(step).screen, ONBOARDING_VERSION);
      await supabase.functions.invoke('track-event', { body: { anonId: await getAnonId(), ...evt } });
    } catch {
      /* ignore */
    }
  })();
}
