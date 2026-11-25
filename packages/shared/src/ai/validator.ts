import { expandEquipment } from './generate.ts';
import type { ExerciseCandidate, PlanInputs, RecipeCandidate } from './prompts.ts';
import type { NutritionPlan, WorkoutPlan } from './schemas.ts';

// Deterministic checks. The LLM never gets to grade its own safety: these run first.

/** Daily macros must land within ±5% of the calc-lib targets. */
export const MACRO_TOLERANCE = 0.05;
/** Sane weekly working sets for one primary muscle. */
export const MAX_WEEKLY_SETS_PER_MUSCLE = 25;
export const MIN_WEEKLY_SETS_PER_TRAINING_DAY = 6;
/** Seconds under tension per set, used for the duration estimate. */
const SECONDS_PER_SET = 40;
const WARMUP_MINUTES = 5;
const DURATION_SLACK = 1.1;
/** Conservative mode (medical red flag): gentler effort and volume. */
export const CONSERVATIVE_MAX_RPE = 7;
export const CONSERVATIVE_MAX_WEEKLY_SETS_PER_MUSCLE = 16;
const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

export function estimateSessionMinutes(day: WorkoutPlan['days'][number]): number {
  const seconds = day.exercises.reduce((t, e) => t + e.sets * (SECONDS_PER_SET + e.restSeconds), 0);
  return Math.round(seconds / 60 + WARMUP_MINUTES);
}

/** Safety rules for one exercise; shared by the validator and the template fallback. */
export function exerciseProblems(info: ExerciseCandidate, inputs: PlanInputs): string[] {
  const problems: string[] = [];
  if (!info.equipment || !new Set(expandEquipment(inputs.equipment)).has(info.equipment)) problems.push('needs equipment the user does not have');
  const hit = info.contraindications.filter((c) => (inputs.contraindications as string[]).includes(c));
  if (hit.length > 0) problems.push(`is contraindicated (${hit.join(', ')})`);
  if (LEVEL_ORDER.indexOf(info.level) > LEVEL_ORDER.indexOf(inputs.level)) problems.push("is above the user's level");
  return problems;
}

/** Safety rules for one recipe; shared by the validator and the template fallback. */
export function recipeProblems(r: RecipeCandidate, inputs: PlanInputs): string[] {
  const problems: string[] = [];
  const hit = r.allergens.filter((a) => (inputs.allergens as string[]).includes(a));
  if (hit.length > 0) problems.push(`contains ${hit.join(', ')}`);
  const dietOk = inputs.diet === 'omnivore' || r.diet === inputs.diet || (inputs.diet === 'vegetarian' && r.diet === 'vegan');
  if (!dietOk) problems.push(`does not fit a ${inputs.diet} diet`);
  return problems;
}

export function validateWorkout(
  plan: WorkoutPlan,
  inputs: PlanInputs,
  library: readonly ExerciseCandidate[],
): string[] {
  const errors: string[] = [];
  const bySlug = new Map(library.map((e) => [e.slug, e]));
  const weekly = new Map<string, number>();

  if (plan.days.length !== inputs.daysPerWeek) {
    errors.push(`The plan has ${plan.days.length} training days; the user trains ${inputs.daysPerWeek} days per week.`);
  }
  plan.days.forEach((day, i) => {
    const label = `Day ${i + 1}`;
    for (const ex of day.exercises) {
      const info = bySlug.get(ex.exerciseSlug);
      if (!info) {
        errors.push(`${label}: "${ex.exerciseSlug}" is not in the exercise library.`);
        continue;
      }
      for (const p of exerciseProblems(info, inputs)) errors.push(`${label}: "${ex.exerciseSlug}" ${p}.`);
      if (inputs.conservative && ex.rpe > CONSERVATIVE_MAX_RPE) {
        errors.push(`${label}: "${ex.exerciseSlug}" has RPE ${ex.rpe}; keep it at ${CONSERVATIVE_MAX_RPE} or lower.`);
      }
      if (ex.repsMin > ex.repsMax) errors.push(`${label}: repsMin is above repsMax for "${ex.exerciseSlug}".`);
      for (const m of info.muscles) weekly.set(m, (weekly.get(m) ?? 0) + ex.sets);
    }
    const minutes = estimateSessionMinutes(day);
    if (minutes > inputs.sessionMinutes * DURATION_SLACK) {
      errors.push(`${label}: about ${minutes} min, over the ${inputs.sessionMinutes} min available.`);
    }
  });
  for (const [muscle, sets] of weekly) {
    const max = inputs.conservative ? CONSERVATIVE_MAX_WEEKLY_SETS_PER_MUSCLE : MAX_WEEKLY_SETS_PER_MUSCLE;
    if (sets > max) {
      errors.push(`${muscle} gets ${sets} sets per week; the maximum is ${max}.`);
    }
  }
  const total = plan.days.reduce((t, d) => t + d.exercises.reduce((s, e) => s + e.sets, 0), 0);
  if (total < MIN_WEEKLY_SETS_PER_TRAINING_DAY * plan.days.length) {
    errors.push(`Too little volume: ${total} sets per week in total.`);
  }
  return errors;
}

export interface NutritionTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Day totals computed from the recipes (the model's own numbers are ignored). */
export function nutritionDayTotals(
  day: NutritionPlan['days'][number],
  library: ReadonlyMap<string, RecipeCandidate>,
): NutritionTotals {
  const t = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const m of day.meals) {
    const r = library.get(m.recipeSlug);
    if (!r) continue;
    t.kcal += (r.kcal ?? 0) * m.portions;
    t.proteinG += (r.protein_g ?? 0) * m.portions;
    t.carbsG += (r.carbs_g ?? 0) * m.portions;
    t.fatG += (r.fat_g ?? 0) * m.portions;
  }
  return t;
}

export function validateNutrition(
  plan: NutritionPlan,
  inputs: PlanInputs,
  library: readonly RecipeCandidate[],
): string[] {
  const errors: string[] = [];
  const bySlug = new Map(library.map((r) => [r.slug, r]));

  plan.days.forEach((day, i) => {
    const label = `Day ${i + 1} (${day.dayType})`;
    let unknown = false;
    for (const m of day.meals) {
      const r = bySlug.get(m.recipeSlug);
      if (!r) {
        errors.push(`${label}: "${m.recipeSlug}" is not in the recipe library.`);
        unknown = true;
        continue;
      }
      for (const p of recipeProblems(r, inputs)) errors.push(`${label}: "${m.recipeSlug}" ${p}.`);
    }
    if (unknown) return;
    const target = inputs.targets[day.dayType];
    const got = nutritionDayTotals(day, bySlug);
    const pairs: [string, number, number][] = [
      ['kcal', got.kcal, target.kcal],
      ['protein', got.proteinG, target.proteinG],
      ['carbs', got.carbsG, target.carbsG],
      ['fat', got.fatG, target.fatG],
    ];
    for (const [name, value, want] of pairs) {
      if (Math.abs(value - want) > want * MACRO_TOLERANCE) {
        errors.push(`${label}: ${name} is ${Math.round(value)}, target is ${want} (±${MACRO_TOLERANCE * 100}%).`);
      }
    }
  });
  return errors;
}
