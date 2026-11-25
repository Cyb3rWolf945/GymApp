import { calorieTarget, trainingRestSplit, type Goal, type RiskFlag } from '../calc/index.ts';
import { ALLERGENS, CONTRAINDICATIONS, DIETS, EQUIPMENT, EXERCISE_LEVELS } from '../catalog/index.ts';
import { z } from 'zod';
import type { StructuredCall } from './openrouter.ts';
import type { PlanInputs } from './prompts.ts';

/** What onboarding stores in profiles.onboarding. Unknown keys are ignored. */
export const OnboardingSchema = z.object({
  goalType: z.enum(['cut', 'bulk', 'recomp']).default('recomp'),
  cutPace: z.enum(['slow', 'moderate', 'aggressive']).default('moderate'),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).default('moderate'),
  daysPerWeek: z.number().int().min(1).max(7).default(3),
  sessionMinutes: z.number().int().min(20).max(180).default(75),
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
export interface PlanInputOptions {
  /** From the guardrails: a medical red flag was seen. */
  conservative?: boolean;
  extraFlags?: RiskFlag[];
}

export function buildPlanInputs(row: ProfileRow, today = new Date(), opts: PlanInputOptions = {}): PlanInputs {
  if ((row.sex !== 'male' && row.sex !== 'female') || !row.birth_date || !row.height_cm || !row.weight_kg) {
    throw new PlanInputError('Profile is incomplete.');
  }
  const ob = OnboardingSchema.parse(row.onboarding ?? {});
  const flags = [...new Set([...(ob.flags as RiskFlag[]), ...(opts.extraFlags ?? [])])];
  const conservative = opts.conservative === true || flags.length > 0;
  // Conservative mode never uses more than the slowest cut pace.
  const pace = conservative ? 'slow' : ob.cutPace;
  const goal: Goal = ob.goalType === 'cut' ? { type: 'cut', pace } : { type: ob.goalType };
  const target = calorieTarget(
    {
      sex: row.sex,
      age: ageFromBirthDate(row.birth_date, today),
      weightKg: Number(row.weight_kg),
      heightCm: Number(row.height_cm),
      activity: ob.activity,
      flags,
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
    sessionMinutes: ob.sessionMinutes,
    conservative,
    equipment: ob.equipment,
    contraindications: ob.contraindications,
    allergens: ob.allergens,
    diet: ob.diet,
    targets: trainingRestSplit(target.kcal, Number(row.weight_kg), ob.goalType, ob.daysPerWeek, row.sex),
  };
}

export type CallFn = <T>(call: StructuredCall<T>) => Promise<T>;

/** Gym tiers include the individual equipment kinds. Bodyweight is always available. */
export function expandEquipment(selected: readonly string[]): string[] {
  const out = new Set<string>(['bodyweight', ...selected]);
  if (out.has('full_gym')) EQUIPMENT.forEach((e) => out.add(e));
  if (out.has('basic_gym')) ['dumbbells', 'barbell', 'bands', 'kettlebell'].forEach((e) => out.add(e));
  return [...out];
}
