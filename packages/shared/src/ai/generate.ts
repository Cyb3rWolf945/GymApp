import { calorieTarget, trainingRestSplit, type Goal, type RiskFlag } from '../calc/index.ts';
import { ALLERGENS, CONTRAINDICATIONS, DIETS, EQUIPMENT, EXERCISE_LEVELS } from '../catalog/index.ts';
import { z } from 'zod';
import { AiCallError, type StructuredCall } from './openrouter.ts';
import {
  type ExerciseCandidate,
  type PlanInputs,
  type RecipeCandidate,
  SYSTEM_PROMPTS,
  buildUserMessage,
} from './prompts.ts';
import {
  type NutritionPlan,
  PLAN_SCHEMAS,
  type PlanKind,
  type WorkoutPlan,
  validateNutritionPlan,
  validateWorkoutPlan,
} from './schemas.ts';

/** What onboarding stores in profiles.onboarding. Unknown keys are ignored. */
export const OnboardingSchema = z.object({
  goalType: z.enum(['cut', 'bulk', 'recomp']).default('recomp'),
  cutPace: z.enum(['slow', 'moderate', 'aggressive']).default('moderate'),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).default('moderate'),
  daysPerWeek: z.number().int().min(1).max(7).default(3),
  equipment: z.array(z.enum(EQUIPMENT)).default(['bodyweight']),
  contraindications: z.array(z.enum(CONTRAINDICATIONS)).default([]),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  diet: z.enum(DIETS).default('omnivore'),
  flags: z.array(z.enum(['under_18', 'pregnant', 'breastfeeding', 'eating_disorder_history', 'medical_condition'])).default([]),
});

export interface ProfileRow {
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  experience: string | null;
  onboarding: unknown;
}

export class PlanInputError extends Error {}

export function ageFromBirthDate(birthDate: string, today: Date): number {
  const b = new Date(birthDate);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/** Profile row → LLM inputs. Calorie and macro targets come from the calc lib, never the LLM. */
export function buildPlanInputs(row: ProfileRow, today = new Date()): PlanInputs {
  if ((row.sex !== 'male' && row.sex !== 'female') || !row.birth_date || !row.height_cm || !row.weight_kg) {
    throw new PlanInputError('Profile is incomplete.');
  }
  const ob = OnboardingSchema.parse(row.onboarding ?? {});
  const goal: Goal = ob.goalType === 'cut' ? { type: 'cut', pace: ob.cutPace } : { type: ob.goalType };
  const target = calorieTarget(
    {
      sex: row.sex,
      age: ageFromBirthDate(row.birth_date, today),
      weightKg: Number(row.weight_kg),
      heightCm: Number(row.height_cm),
      activity: ob.activity,
      flags: ob.flags as RiskFlag[],
    },
    goal,
  );
  const level = (EXERCISE_LEVELS as readonly string[]).includes(row.experience ?? '')
    ? (row.experience as PlanInputs['level'])
    : 'beginner';
  return {
    goal: ob.goalType,
    level,
    daysPerWeek: ob.daysPerWeek,
    equipment: ob.equipment,
    contraindications: ob.contraindications,
    allergens: ob.allergens,
    diet: ob.diet,
    targets: trainingRestSplit(target.kcal, Number(row.weight_kg), ob.goalType, ob.daysPerWeek, row.sex),
  };
}

export type CallFn = <T>(call: StructuredCall<T>) => Promise<T>;

export interface GenerateArgs {
  kind: PlanKind;
  userId: string;
  jobId: string;
  inputs: PlanInputs;
  candidates: ExerciseCandidate[] | RecipeCandidate[];
  memorySummary: string;
  call: CallFn;
  /** True when the profile has an escalation model. */
  canEscalate: boolean;
}

/**
 * Run one plan generation: cheap model first; if the output fails schema or deterministic
 * validation, retry once on the escalation model (prod only).
 */
export async function generatePlan(args: GenerateArgs): Promise<WorkoutPlan | NutritionPlan> {
  const { kind } = args;
  const { name, schema } = PLAN_SCHEMAS[kind];
  const allowed = new Set(args.candidates.map((c) => c.slug));
  const user = buildUserMessage(kind, args.inputs, args.candidates, args.memorySummary);

  const attempt = async (escalate: boolean) => {
    const plan = await args.call({
      role: 'planner',
      schemaName: name,
      schema: schema as z.ZodType<WorkoutPlan | NutritionPlan>,
      system: SYSTEM_PROMPTS[kind],
      user,
      userId: args.userId,
      jobId: args.jobId,
      escalate,
    });
    const errors =
      kind === 'workout_plan'
        ? validateWorkoutPlan(plan as WorkoutPlan, allowed)
        : validateNutritionPlan(plan as NutritionPlan, allowed);
    if (errors.length > 0) throw new AiCallError('INVALID_OUTPUT', errors.slice(0, 3).join('; '));
    return plan;
  };

  try {
    return await attempt(false);
  } catch (e) {
    if (e instanceof AiCallError && e.code === 'INVALID_OUTPUT' && args.canEscalate) return attempt(true);
    throw e;
  }
}

/** Gym tiers include the individual equipment kinds. Bodyweight is always available. */
export function expandEquipment(selected: readonly string[]): string[] {
  const out = new Set<string>(['bodyweight', ...selected]);
  if (out.has('full_gym')) EQUIPMENT.forEach((e) => out.add(e));
  if (out.has('basic_gym')) ['dumbbells', 'barbell', 'bands', 'kettlebell'].forEach((e) => out.add(e));
  return [...out];
}
