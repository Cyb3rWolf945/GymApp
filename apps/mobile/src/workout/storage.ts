import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OutboxItem } from '@gymapp/shared';
import type { ActiveWorkout } from './types';

const ACTIVE = 'fuelift.workout.active';
const OUTBOX = 'fuelift.workout.outbox';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function write(key: string, value: unknown): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked; the workout then lives in memory only */
  }
}

export const loadActive = () => read<ActiveWorkout | null>(ACTIVE, null);
export const saveActive = (w: ActiveWorkout | null) => write(ACTIVE, w);
export const loadOutbox = () => read<OutboxItem[]>(OUTBOX, []);
export const saveOutbox = (q: OutboxItem[]) => write(OUTBOX, q);
