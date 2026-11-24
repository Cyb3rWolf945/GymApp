import { z } from 'zod';

// LLM output contracts. Converted to JSON Schema for response_format, then validated
// again deterministically (slugs exist in the candidate lists, etc.) by the caller.

const slug = z.string().min(1).max(80);

export const WORKOUT_SPLITS = ['full_body', 'upper_lower', 'push_pull_legs', 'body_part'] as const;

export const WorkoutExerciseSchema = z.object({
  exerciseSlug: slug,
  sets: z.number().int().min(1).max(8),
  repsMin: z.number().int().min(1).max(50),
  repsMax: z.number().int().min(1).max(50),
  rpe: z.number().min(5).max(10),
  restSeconds: z.number().int().min(15).max(600),
});

export const WorkoutPlanSchema = z.object({
  split: z.enum(WORKOUT_SPLITS),
  days: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        exercises: z.array(WorkoutExerciseSchema).min(1).max(12),
      }),
    )
    .min(1)
    .max(7),
  rationale: z.string().min(1).max(1200),
});
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

export const NutritionMealSchema = z.object({
  name: z.string().min(1).max(40),
  recipeSlug: slug,
  /** Multiplier of the recipe's stated serving. */
  portions: z.number().min(0.25).max(4),
});

export const NutritionPlanSchema = z.object({
  days: z
    .array(
      z.object({
        dayType: z.enum(['training', 'rest']),
        meals: z.array(NutritionMealSchema).min(2).max(6),
        kcal: z.number().min(800).max(6000),
        proteinG: z.number().min(0).max(500),
        carbsG: z.number().min(0).max(1000),
        fatG: z.number().min(0).max(400),
      }),
    )
    .min(1)
    .max(7),
  rationale: z.string().min(1).max(1200),
});
export type NutritionPlan = z.infer<typeof NutritionPlanSchema>;

export const PLAN_KINDS = ['workout_plan', 'nutrition_plan'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_SCHEMAS = {
  workout_plan: { name: 'workout_plan', schema: WorkoutPlanSchema },
  nutrition_plan: { name: 'nutrition_plan', schema: NutritionPlanSchema },
} as const;

/** JSON Schema for OpenRouter `response_format.json_schema.schema` (strict mode). */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

/** Deterministic checks the JSON Schema cannot express. Returns error strings (empty = ok). */
export function validateWorkoutPlan(plan: WorkoutPlan, allowedSlugs: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  plan.days.forEach((d, i) =>
    d.exercises.forEach((e) => {
      if (!allowedSlugs.has(e.exerciseSlug)) errors.push(`day ${i + 1}: unknown exercise "${e.exerciseSlug}"`);
      if (e.repsMin > e.repsMax) errors.push(`day ${i + 1}: repsMin > repsMax for "${e.exerciseSlug}"`);
    }),
  );
  return errors;
}

export function validateNutritionPlan(plan: NutritionPlan, allowedSlugs: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  plan.days.forEach((d, i) =>
    d.meals.forEach((m) => {
      if (!allowedSlugs.has(m.recipeSlug)) errors.push(`day ${i + 1}: unknown recipe "${m.recipeSlug}"`);
    }),
  );
  return errors;
}
