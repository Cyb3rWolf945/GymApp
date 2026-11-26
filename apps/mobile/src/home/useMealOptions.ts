import { useEffect, useState } from 'react';
import { type MealOption, type MealOptionsInput, type RecipeCandidate, mealOptions } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { fetchRecipeLibrary, fetchSwappedAway } from '../plan/api';

// One recipe library per app session, shared by Today and Nutrition (it changes with a data update, not with a swap).
let library: Promise<RecipeCandidate[]> | null = null;
const loadLibrary = (): Promise<RecipeCandidate[]> => {
  library ??= fetchRecipeLibrary().catch((e) => {
    library = null; // try again next time
    throw e;
  });
  return library;
};

/** What the options need besides the plan: the recipe library and the recipes the user swapped away from before. `null` while loading or when it failed. */
export function useOptionSources(version: unknown): { library: RecipeCandidate[]; swappedAway: string[] } | null {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [sources, setSources] = useState<{ library: RecipeCandidate[]; swappedAway: string[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.all([loadLibrary(), fetchSwappedAway(userId)]).then(
      ([lib, away]) => active && setSources({ library: lib, swappedAway: away }),
      () => active && setSources(null),
    );
    return () => {
      active = false;
    };
  }, [userId, version]);
  return sources;
}

export type SlotOptionsInput = Omit<MealOptionsInput, 'library' | 'swappedAway' | 'seed'>;

/** The ranked options for one slot, the same function for Today and Nutrition. */
export function optionsForSlot(sources: { library: RecipeCandidate[]; swappedAway: string[] } | null, userId: string | undefined, input: SlotOptionsInput, limit?: number): MealOption[] {
  if (!sources) return [];
  return mealOptions({ ...input, library: sources.library, swappedAway: sources.swappedAway, seed: userId, limit });
}

/** A random id for a row the app inserts itself (so "Undo" can delete it without reading it back). */
export function newRowId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));
}
