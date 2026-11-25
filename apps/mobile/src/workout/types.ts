import type { LoggedSet, PlannedExercise, Prefill } from '@gymapp/shared';

export interface PlannedWithId extends PlannedExercise {
  /** exercises.id; null if the catalog has no such slug (the set is then not synced). */
  exerciseId: string | null;
}

export interface ActiveSet extends LoggedSet {
  id: string;
  setIndex: number;
  loggedAt: string;
}

/** A workout in progress. Saved on every change, so closing the app does not lose it. */
export interface ActiveWorkout {
  id: string;
  startedAt: string;
  dayName: string;
  planned: PlannedWithId[];
  logged: ActiveSet[];
  /** Prefill source: the best set of the last workout, per slug. */
  lastWorkout: Record<string, Prefill>;
  /** PR baseline: best e1RM before this workout, per slug. */
  previousBest: Record<string, number>;
  finishedAt: string | null;
}
