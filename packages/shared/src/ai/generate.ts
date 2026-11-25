import { calorieTarget, trainingRestSplit, type Goal, type RiskFlag } from '../calc/index.ts';
import { ALLERGENS, CONTRAINDICATIONS, DIETS, EQUIPMENT, EXERCISE_LEVELS } from '../catalog/index.ts';
import { z } from 'zod';
import { parseCoachStyle } from './coach.ts';
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
  /** E-55: `profiles.coach_style`; missing or unknown means Calm. */
  coach_style?: string | null;
}

/** The profile cannot make a plan. `fields` names what is missing (column names only, never values). */
export class PlanInputError extends Error {
  constructor(
    message: string,
    public readonly fields: string[] = [],
  ) {
    super(message);
    this.name = 'PlanInputError';
  }
}

/** The columns a plan cannot be built without that are not usable yet. Empty when the profile is complete. */
export function missingProfileFields(row: Pick<ProfileRow, 'sex' | 'birth_date' | 'height_cm' | 'weight_kg'> | null | undefined): string[] {
  if (!row) return ['profile'];
  const missing: string[] = [];
  if (row.sex !== 'male' && row.sex !== 'female') missing.push('sex');
  if (!row.birth_date) missing.push('birth_date');
  if (!row.height_cm) missing.push('height_cm');
  if (!row.weight_kg) missing.push('weight_kg');
  return missing;
}

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
  const missing = missingProfileFields(row);
  if (missing.length > 0 || (row.sex !== 'male' && row.sex !== 'female') || !row.birth_date) throw new PlanInputError('Profile is incomplete.', missing);
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
    coachStyle: parseCoachStyle(row.coach_style),
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
