import { z } from 'zod';
import { ALLERGENS, CONTRAINDICATIONS, DIETS, EQUIPMENT, EXERCISE_LEVELS } from '../catalog/index.ts';
import { FREE_TEXT_MAX } from '../ai/guardrails.ts';

// Onboarding answers (docs/SPEC.md → "Ecrãs do onboarding"). One Zod schema per screen, shared by
// the app, the web quiz (E-22) and the backend. Values are always stored in metric units.
// Keys match what the plan generator reads from profiles.onboarding (see OnboardingSchema in ai/generate.ts).

export const ONBOARDING_VERSION = 1;

export const GOALS = ['cut', 'bulk', 'recomp'] as const;
export const SEXES = ['male', 'female'] as const;
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export const CUT_PACES = ['slow', 'moderate', 'aggressive'] as const;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const SESSION_MINUTES = [30, 45, 60, 90] as const;
export const LOCATIONS = ['gym', 'home', 'outdoors'] as const;
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export const MEALS_PER_DAY = [3, 4, 5, 6] as const;
export const BUDGETS = ['low', 'medium', 'high'] as const;
export const COOKING_MINUTES = [15, 30, 45, 60] as const;
export const DISLIKE_OPTIONS = ['mushrooms', 'olives', 'fish', 'liver', 'tofu', 'broccoli', 'onion', 'cilantro', 'spicy food', 'eggplant'] as const;

export const Limits = {
  age: { min: 14, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 400 },
  days: { min: 2, max: 6 },
} as const;

const lift = z.number().min(20).max(500).optional();

export const WelcomeSchema = z.object({});

export const GoalSchema = z.object({ goalType: z.enum(GOALS) });

export const BasicsSchema = z.object({
  sex: z.enum(SEXES),
  age: z.number().int().min(Limits.age.min).max(Limits.age.max),
  heightCm: z.number().min(Limits.heightCm.min).max(Limits.heightCm.max),
  weightKg: z.number().min(Limits.weightKg.min).max(Limits.weightKg.max),
  units: z.enum(UNIT_SYSTEMS),
});

/** Skippable; only shown when the goal is a weight goal (cut or bulk). */
export const TargetSchema = z.object({
  targetWeightKg: z.number().min(Limits.weightKg.min).max(Limits.weightKg.max).optional(),
  cutPace: z.enum(CUT_PACES).optional(),
});

export const ExperienceSchema = z.object({
  experience: z.enum(EXERCISE_LEVELS),
  referenceLifts: z.object({ squatKg: lift, benchKg: lift, deadliftKg: lift }).optional(),
});

export const AvailabilitySchema = z.object({
  daysPerWeek: z.number().int().min(Limits.days.min).max(Limits.days.max),
  sessionMinutes: z.union(SESSION_MINUTES.map((m) => z.literal(m)) as unknown as [z.ZodLiteral<30>, z.ZodLiteral<45>, z.ZodLiteral<60>, z.ZodLiteral<90>]),
  preferredDays: z.array(z.enum(WEEKDAYS)).max(7).optional(),
});

export const EquipmentSchema = z.object({
  location: z.enum(LOCATIONS),
  equipment: z.array(z.enum(EQUIPMENT)).min(1),
});

/** Skippable. Body zones are the same vocabulary as exercise contraindications. */
export const InjuriesSchema = z.object({
  contraindications: z.array(z.enum(CONTRAINDICATIONS)).default([]),
  injuryNote: z.string().max(FREE_TEXT_MAX).optional(),
});

export const ActivitySchema = z.object({ activity: z.enum(ACTIVITY_LEVELS) });

export const DietSchema = z.object({
  diet: z.enum(DIETS),
  mealsPerDay: z.union(MEALS_PER_DAY.map((m) => z.literal(m)) as unknown as [z.ZodLiteral<3>, z.ZodLiteral<4>, z.ZodLiteral<5>, z.ZodLiteral<6>]),
});

/** Allergens are a hard constraint for plan generation. */
export const AllergiesSchema = z.object({
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  dislikes: z.array(z.enum(DISLIKE_OPTIONS)).default([]),
});

/** Skippable. */
export const BudgetSchema = z.object({
  budget: z.enum(BUDGETS).optional(),
  cookingMinutes: z.union(COOKING_MINUTES.map((m) => z.literal(m)) as unknown as [z.ZodLiteral<15>, z.ZodLiteral<30>, z.ZodLiteral<45>, z.ZodLiteral<60>]).optional(),
});

/** Explicit consent is required for terms, privacy and health data (GDPR special category). */
export const ConsentsSchema = z.object({
  consents: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    healthData: z.literal(true),
    disclaimer: z.literal(true),
    notifications: z.boolean().default(false),
  }),
});

export const OnboardingAnswersSchema = z.object({
  ...GoalSchema.shape,
  ...BasicsSchema.shape,
  ...TargetSchema.shape,
  ...ExperienceSchema.shape,
  ...AvailabilitySchema.shape,
  ...EquipmentSchema.shape,
  ...InjuriesSchema.shape,
  ...ActivitySchema.shape,
  ...DietSchema.shape,
  ...AllergiesSchema.shape,
  ...BudgetSchema.shape,
  ...ConsentsSchema.shape,
});
export type OnboardingAnswers = z.infer<typeof OnboardingAnswersSchema>;
/** Answers while the flow is in progress. */
export type PartialAnswers = Partial<OnboardingAnswers>;
