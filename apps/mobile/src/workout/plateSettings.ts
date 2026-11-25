import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type PlateConfig, type PlateUnit, defaultPlateConfig, normalizePlateConfig } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabase';

// E-56: the bar and the plates the gym has, kept on the device (the logger must work offline). One setting per unit.
const key = (unit: PlateUnit) => `fuelift.plates.${unit}`;
const unitKey = 'fuelift.units';
const listeners = new Set<() => void>();

async function load(unit: PlateUnit): Promise<PlateConfig> {
  try {
    const raw = await AsyncStorage.getItem(key(unit));
    return normalizePlateConfig(raw ? (JSON.parse(raw) as Partial<PlateConfig>) : null, unit);
  } catch {
    return defaultPlateConfig(unit);
  }
}

/** kg for metric profiles, lb for imperial. The last known unit is kept for offline use. */
async function loadUnit(userId: string | undefined): Promise<PlateUnit> {
  let unit: PlateUnit | null = null;
  if (userId) {
    try {
      const { data } = await supabase.from('profiles').select('units').eq('user_id', userId).maybeSingle();
      const u = (data as { units?: string } | null)?.units;
      if (u === 'imperial' || u === 'metric') {
        unit = u === 'imperial' ? 'lb' : 'kg';
        await AsyncStorage.setItem(unitKey, unit);
      }
    } catch {
      // offline: use the last known unit
    }
  }
  if (unit) return unit;
  return (await AsyncStorage.getItem(unitKey)) === 'lb' ? 'lb' : 'kg';
}

export function usePlateConfig(): { config: PlateConfig; save: (c: PlateConfig) => Promise<void> } {
  const { user } = useAuth();
  const [config, setConfig] = useState<PlateConfig>(defaultPlateConfig('kg'));
  useEffect(() => {
    let active = true;
    const read = () => void loadUnit(user?.id).then((u) => load(u)).then((c) => active && setConfig(c));
    read();
    listeners.add(read);
    return () => {
      active = false;
      listeners.delete(read);
    };
  }, [user?.id]);
  const save = useCallback(async (c: PlateConfig) => {
    await AsyncStorage.setItem(key(c.unit), JSON.stringify({ bar: c.bar, plates: c.plates }));
    listeners.forEach((fn) => fn());
  }, []);
  return { config, save };
}
