import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onPlanChanged } from '../home/planVersion';

// "Your profile changed. Update your plan to match." A flag per user, set when an edit changes something the plan is
// built from, cleared when the plan is regenerated ("Update my plan" signals `notifyPlanChanged`). No LLM call happens here.
const key = (userId: string) => `fuelift.plan_outdated.${userId}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export async function markPlanOutdated(userId: string): Promise<void> {
  await AsyncStorage.setItem(key(userId), new Date().toISOString());
  emit();
}
export async function clearPlanOutdated(userId: string): Promise<void> {
  await AsyncStorage.removeItem(key(userId));
  emit();
}
export async function isPlanOutdated(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key(userId))) !== null;
}

/** True while the plan is out of date. Updates when the flag is set or cleared. */
export function usePlanOutdated(userId: string | undefined): boolean {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const read = () => void isPlanOutdated(userId).then((v) => active && setOutdated(v));
    read();
    listeners.add(read);
    // A regenerated plan is up to date again.
    const off = onPlanChanged(() => void clearPlanOutdated(userId));
    return () => {
      active = false;
      listeners.delete(read);
      off();
    };
  }, [userId]);
  return outdated;
}
