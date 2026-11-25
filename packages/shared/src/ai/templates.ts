import type { ExerciseCandidate, PlanInputs, RecipeCandidate } from './prompts.ts';
import { exerciseProblems, recipeProblems } from './validator.ts';
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

export function nutritionTemplate(inputs: PlanInputs, library: readonly RecipeCandidate[]): NutritionPlan {
  const usable = library.filter((r) => (r.kcal ?? 0) > 0 && recipeProblems(r, inputs).length === 0);
  if (usable.length < 2) throw new Error('Not enough recipes available for the template.');
  const dayTypes = (inputs.daysPerWeek >= 7 ? ['training'] : inputs.daysPerWeek <= 0 ? ['rest'] : ['training', 'rest']) as ('training' | 'rest')[];
  const days = dayTypes.map((dayType) => {
    const target = inputs.targets[dayType];
    const mealCount = Math.min(3, usable.length);
    const perMeal = target.kcal / mealCount;
    const chosen = [...usable]
      .sort((a, b) => Math.abs(a.kcal! - perMeal) - Math.abs(b.kcal! - perMeal) || a.slug.localeCompare(b.slug))
      .slice(0, mealCount);
    const base = chosen.reduce((t, r) => t + r.kcal!, 0);
    const scale = Math.min(4, Math.max(0.25, Math.round((target.kcal / base) * 4) / 4));
    const meals = chosen.map((r, i) => ({ name: ['Meal 1', 'Meal 2', 'Meal 3'][i], recipeSlug: r.slug, portions: scale }));
    const sum = (f: (r: RecipeCandidate) => number | null) => Math.round(chosen.reduce((t, r) => t + (f(r) ?? 0) * scale, 0));
    return {
      dayType,
      meals,
      kcal: Math.max(800, sum((r) => r.kcal)),
      proteinG: sum((r) => r.protein_g),
      carbsG: sum((r) => r.carbs_g),
      fatG: sum((r) => r.fat_g),
    };
  });
  return { days, rationale: 'A simple plan close to your daily targets. Swap meals you like less.' };
}
