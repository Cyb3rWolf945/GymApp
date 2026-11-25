import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_VERSION, OnboardingAnswersSchema, type PartialAnswers, type StepId, isStepId } from '@gymapp/shared';

export const STORAGE_KEY = 'fuelift.onboarding';

export interface PersistedOnboarding {
  version: number;
  stepId: StepId;
  answers: PartialAnswers;
}

export const serialize = (s: PersistedOnboarding): string => JSON.stringify(s);

/** Anything unreadable, from another version or off-schema is dropped: the user just starts over. */
export function parsePersisted(raw: string | null): PersistedOnboarding | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { version?: unknown; stepId?: unknown; answers?: unknown };
    if (v.version !== ONBOARDING_VERSION || !isStepId(v.stepId)) return null;
    const answers = OnboardingAnswersSchema.partial().safeParse(v.answers);
    if (!answers.success) return null;
    return { version: ONBOARDING_VERSION, stepId: v.stepId, answers: answers.data };
  } catch {
    return null;
  }
}

export async function loadOnboarding(): Promise<PersistedOnboarding | null> {
  try {
    return parsePersisted(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
export async function saveOnboarding(s: PersistedOnboarding): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, serialize(s));
  } catch {
    /* storage can be blocked (private mode); the flow still works in memory */
  }
}
export async function clearOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
