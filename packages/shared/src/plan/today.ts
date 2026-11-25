import { WEEKDAYS } from '../onboarding/schema.ts';
import { NutritionPlanSchema, WorkoutPlanSchema, type NutritionPlan, type WorkoutPlan } from '../ai/schemas.ts';
import { estimateSessionMinutes, nutritionDayTotals, type NutritionTotals } from '../ai/validator.ts';
import type { RecipeCandidate } from '../ai/prompts.ts';

// "Today" view model. The plan is a list of workout days, not dated sessions, so we map plan days
// onto weekdays: the user's preferred days when they gave enough, otherwise an even default spread.

export type Weekday = (typeof WEEKDAYS)[number];

const DEFAULT_SCHEDULE: Record<number, Weekday[]> = {
  1: ['wed'],
  2: ['mon', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'fri', 'sat'],
  6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  7: [...WEEKDAYS],
};

const byWeek = (a: Weekday, b: Weekday) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b);

/** The `n` weekdays the user trains on, in week order. Preferred days first; gaps filled from the default spread. */
export function trainingWeekdays(n: number, preferred: readonly Weekday[] = []): Weekday[] {
  const count = Math.min(7, Math.max(0, Math.round(n)));
  const chosen = [...new Set(preferred)].sort(byWeek).slice(0, count);
  for (const d of DEFAULT_SCHEDULE[count] ?? []) {
    if (chosen.length >= count) break;
    if (!chosen.includes(d)) chosen.push(d);
  }
  for (const d of WEEKDAYS) {
    if (chosen.length >= count) break;
    if (!chosen.includes(d)) chosen.push(d);
  }
  return chosen.sort(byWeek);
}

/** Local weekday of a date (Monday-first like WEEKDAYS). */
export const weekdayOf = (date: Date): Weekday => WEEKDAYS[(date.getDay() + 6) % 7];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export interface TodayWorkout {
  kind: 'workout';
  dayName: string;
  minutes: number;
  exercises: { slug: string; name: string; sets: number; reps: string }[];
}
export interface TodayRest {
  kind: 'rest';
  /** The next training day, if the plan has any. */
  next: { weekday: Weekday; dayName: string } | null;
}

export interface TodayMeals {
  dayType: 'training' | 'rest';
  meals: { name: string; recipe: string; portions: number; kcal: number; proteinG: number; carbsG: number; fatG: number }[];
  /** Planned totals, computed from the recipes. */
  totals: NutritionTotals;
}

export interface TodayView {
  workout: TodayWorkout | TodayRest | null;
  meals: TodayMeals | null;
}

const planOf = (result: unknown): unknown => (result && typeof result === 'object' ? (result as { plan?: unknown }).plan : undefined);

const reps = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

export function buildToday(args: {
  workoutResult: unknown;
  nutritionResult: unknown;
  preferredDays?: readonly Weekday[];
  date: Date;
  exerciseNames: ReadonlyMap<string, string>;
  recipes: readonly RecipeCandidate[];
}): TodayView {
  const wp = WorkoutPlanSchema.safeParse(planOf(args.workoutResult));
  const np = NutritionPlanSchema.safeParse(planOf(args.nutritionResult));
  const today = weekdayOf(args.date);

  let isTraining = false;
  let workout: TodayView['workout'] = null;
  if (wp.success) {
    const plan: WorkoutPlan = wp.data;
    const schedule = trainingWeekdays(plan.days.length, args.preferredDays);
    const i = schedule.indexOf(today);
    isTraining = i >= 0;
    if (isTraining) {
      const day = plan.days[i];
      workout = {
        kind: 'workout',
        dayName: day.name,
        minutes: estimateSessionMinutes(day),
        exercises: day.exercises.map((e) => ({
          slug: e.exerciseSlug,
          name: args.exerciseNames.get(e.exerciseSlug) ?? e.exerciseSlug,
          sets: e.sets,
          reps: reps(e.repsMin, e.repsMax),
        })),
      };
    } else {
      // Next training weekday after today (wrapping to next week).
      const order = WEEKDAYS.indexOf(today);
      const nextIdx = schedule.findIndex((d) => WEEKDAYS.indexOf(d) > order);
      const k = nextIdx >= 0 ? nextIdx : 0;
      workout = { kind: 'rest', next: schedule.length ? { weekday: schedule[k], dayName: plan.days[k].name } : null };
    }
  }

  let meals: TodayMeals | null = null;
  if (np.success) {
    const plan: NutritionPlan = np.data;
    const dayType = isTraining ? 'training' : 'rest';
    const day = plan.days.find((d) => d.dayType === dayType) ?? plan.days[0];
    const bySlug = new Map(args.recipes.map((r) => [r.slug, r]));
    meals = {
      dayType: day.dayType,
      totals: nutritionDayTotals(day, bySlug),
      meals: day.meals.map((m) => {
        const r = bySlug.get(m.recipeSlug);
        const f = (v: number | null | undefined) => Math.round((v ?? 0) * m.portions);
        return { name: m.name, recipe: r?.name ?? m.recipeSlug, portions: m.portions, kcal: f(r?.kcal), proteinG: f(r?.protein_g), carbsG: f(r?.carbs_g), fatG: f(r?.fat_g) };
      }),
    };
  }
  return { workout, meals };
}

/** Toggle one meal in the list of eaten meal indexes. */
export function toggleEaten(eaten: readonly number[], index: number): number[] {
  return eaten.includes(index) ? eaten.filter((i) => i !== index) : [...eaten, index].sort((a, b) => a - b);
}

export interface MealProgress {
  eatenCount: number;
  total: number;
  eaten: NutritionTotals;
  /** 0..1 of the daily kcal target (or of the planned kcal when no target is known). */
  fraction: number;
}

export function mealProgress(meals: TodayMeals, eatenIdx: readonly number[], targetKcal?: number): MealProgress {
  const eaten = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  let count = 0;
  meals.meals.forEach((m, i) => {
    if (!eatenIdx.includes(i)) return;
    count += 1;
    eaten.kcal += m.kcal;
    eaten.proteinG += m.proteinG;
    eaten.carbsG += m.carbsG;
    eaten.fatG += m.fatG;
  });
  const denom = targetKcal && targetKcal > 0 ? targetKcal : meals.totals.kcal;
  return { eatenCount: count, total: meals.meals.length, eaten, fraction: denom > 0 ? Math.min(1, eaten.kcal / denom) : 0 };
}

/** Local calendar date as yyyy-mm-dd (the key for a day's eaten meals). */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
