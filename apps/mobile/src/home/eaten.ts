import AsyncStorage from '@react-native-async-storage/async-storage';

// Which of today's meals the user marked as eaten. Device-local for now (follow-up: sync to the database).
const key = (day: string) => `fuelift.eaten.${day}`;

export async function loadEaten(day: string): Promise<number[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(key(day))) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export async function saveEaten(day: string, eaten: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(day), JSON.stringify(eaten));
  } catch {
    /* storage can be blocked; progress then lives in memory only */
  }
}
