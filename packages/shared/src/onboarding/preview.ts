import { type Goal, type Macros, calorieTarget, trainingRestSplit } from '../calc/index.ts';
import type { PartialAnswers } from './schema.ts';

// A live preview of the calorie and macro target while the quiz is being answered. The same calc as the real plan
// (calorieTarget, then the training/rest split), so the number never changes between the quiz and "Building your plan…".

/** Rest-day target, the figure "Building your plan…" shows. */
export type TargetsPreview = Macros;

/** Training days assumed until the availability screen has been answered (the usual 3). */
export const PREVIEW_DEFAULT_DAYS = 3;

/**
 * The target so far, or `null` until the answers that decide it are in: sex, age, height, weight, activity and goal.
 * Cut pace defaults to moderate and the days per week to 3, as the plan does. Risk flags are not known yet, so a refused
 * aggressive cut is shown as a moderate one (the plan screen applies the safety rules).
 */
export function previewTargets(a: PartialAnswers): TargetsPreview | null {
  if (!a.sex || a.age === undefined || a.heightCm === undefined || a.weightKg === undefined || !a.activity || !a.goalType) return null;
  try {
    const pace = a.cutPace ?? 'moderate';
    const goal: Goal = a.goalType === 'cut' ? { type: 'cut', pace } : { type: a.goalType };
    const target = calorieTarget({ sex: a.sex, age: a.age, weightKg: a.weightKg, heightCm: a.heightCm, activity: a.activity }, goal);
    return trainingRestSplit(target.kcal, a.weightKg, a.goalType, a.daysPerWeek ?? PREVIEW_DEFAULT_DAYS, a.sex).rest;
  } catch {
    return null; // out-of-range answers: nothing to show yet, never an error
  }
}
