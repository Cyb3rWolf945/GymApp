import { nutritionDayTotals, type NutritionTotals } from '../ai/validator.ts';
import { NutritionPlanSchema, WorkoutPlanSchema } from '../ai/schemas.ts';
import type { RecipeCandidate } from '../ai/prompts.ts';

export interface Disclosure {
  disclaimer: string | null;
}

export interface WorkoutPreview {
  dayName: string;
  rationale: string;
  exercises: { slug: string; name: string; sets: number; reps: string; restSeconds: number }[];
}

export interface MealsPreview {
  dayType: 'training' | 'rest';
  rationale: string;
  meals: { name: string; recipe: string; portions: number; kcal: number }[];
  totals: NutritionTotals;
}

export interface PlanPreview {
  workout: WorkoutPreview | null;
  meals: MealsPreview | null;
  /** Medical disclaimer, present when the guardrails turned on conservative mode. */
  disclaimer: string | null;
}

/** generation_jobs.result looks like `{ plan, qa, source, attempts, needsReview, guardrails }`. */
const planOf = (result: unknown): unknown => (result && typeof result === 'object' ? (result as { plan?: unknown }).plan : undefined);
const disclaimerOf = (result: unknown): string | null => {
  const g = result && typeof result === 'object' ? (result as { guardrails?: { disclaimer?: unknown } }).guardrails : undefined;
  return typeof g?.disclaimer === 'string' ? g.disclaimer : null;
};

export const formatReps = (min: number, max: number): string => (min === max ? `${min}` : `${min}–${max}`);

/**
 * First workout + first day of meals for the preview screen.
 * `exerciseNames` and `recipes` come from the catalog; unknown slugs fall back to the slug.
 */
/**
 * True when either plan is the starter template: no model produced a usable plan, so the user got the generic one
 * (`result.source === 'template'`). They are told, and can update the plan later for a personal one.
 */
export function usedStarterPlan(...results: readonly unknown[]): boolean {
  return results.some((r) => !!r && typeof r === 'object' && (r as { source?: unknown }).source === 'template');
}

export function buildPreview(
  workoutResult: unknown,
  nutritionResult: unknown,
  exerciseNames: ReadonlyMap<string, string>,
  recipes: readonly RecipeCandidate[],
): PlanPreview {
  const wp = WorkoutPlanSchema.safeParse(planOf(workoutResult));
  const np = NutritionPlanSchema.safeParse(planOf(nutritionResult));

  const workout: WorkoutPreview | null =
    wp.success && wp.data.days[0]
      ? {
          dayName: wp.data.days[0].name,
          rationale: wp.data.rationale,
          exercises: wp.data.days[0].exercises.map((e) => ({
            slug: e.exerciseSlug,
            name: exerciseNames.get(e.exerciseSlug) ?? e.exerciseSlug,
            sets: e.sets,
            reps: formatReps(e.repsMin, e.repsMax),
            restSeconds: e.restSeconds,
          })),
        }
      : null;

  const bySlug = new Map(recipes.map((r) => [r.slug, r]));
  let meals: MealsPreview | null = null;
  if (np.success && np.data.days[0]) {
    const day = np.data.days[0];
    meals = {
      dayType: day.dayType,
      rationale: np.data.rationale,
      // Numbers come from the recipes, never from the model's own totals.
      totals: nutritionDayTotals(day, bySlug),
      meals: day.meals.map((m) => ({
        name: m.name,
        recipe: bySlug.get(m.recipeSlug)?.name ?? m.recipeSlug,
        portions: m.portions,
        kcal: Math.round((bySlug.get(m.recipeSlug)?.kcal ?? 0) * m.portions),
      })),
    };
  }
  return { workout, meals, disclaimer: disclaimerOf(workoutResult) ?? disclaimerOf(nutritionResult) };
}
