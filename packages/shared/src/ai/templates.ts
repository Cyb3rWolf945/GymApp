import type { ExerciseCandidate, PlanInputs, RecipeCandidate } from './prompts.ts';
import { type TemplateContext, buildNutritionTemplate } from './mealTemplate.ts';
import { exerciseProblems } from './validator.ts';
import type { NutritionPlan, WorkoutPlan } from './schemas.ts';

// Safe fallbacks built without any LLM, from the already-filtered candidates.

const EXERCISES_PER_DAY = 5;

export function workoutTemplate(inputs: PlanInputs, library: readonly ExerciseCandidate[]): WorkoutPlan {
  // Re-check safety here: the template is the last line of defence.
  const safe = library.filter((e) => exerciseProblems(e, inputs).length === 0);
  if (safe.length === 0) throw new Error('No exercises available for the template.');
  // Group by first primary muscle so each day covers different muscles.
  const groups = new Map<string, ExerciseCandidate[]>();
  for (const e of [...safe].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const key = e.muscles[0] ?? 'other';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const lists = [...groups.values()];
  const days = Array.from({ length: inputs.daysPerWeek }, (_, d) => {
    const picked: ExerciseCandidate[] = [];
    for (let i = 0; picked.length < Math.min(EXERCISES_PER_DAY, safe.length) && i < lists.length * 4; i++) {
      const list = lists[(d * EXERCISES_PER_DAY + i) % lists.length];
      const e = list[Math.floor(i / lists.length + d) % list.length];
      if (!picked.includes(e)) picked.push(e);
    }
    return {
      name: `Day ${d + 1}`,
      exercises: picked.map((e) => ({ exerciseSlug: e.slug, sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90 })),
    };
  });
  return { split: 'full_body', days, rationale: 'A simple full-body plan. Add weight when all sets feel easy.' };
}

/** The template meal plan without the extras (relaxed filters): see `buildNutritionTemplate` (E-66). */
export function nutritionTemplate(inputs: PlanInputs, library: readonly RecipeCandidate[], ctx?: TemplateContext): NutritionPlan {
  return buildNutritionTemplate(inputs, library, ctx).plan;
}
