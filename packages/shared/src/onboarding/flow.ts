import type { z } from 'zod';
import {
  ActivitySchema, AllergiesSchema, AvailabilitySchema, BasicsSchema, BudgetSchema, CoachStyleSchema, ConsentsSchema, DietSchema,
  EquipmentSchema, ExperienceSchema, GoalSchema, InjuriesSchema, OnboardingAnswersSchema, type PartialAnswers,
  TargetSchema, WelcomeSchema,
} from './schema.ts';

export interface StepDef {
  id: StepId;
  /** Screen number in the spec (1–13). */
  screen: number;
  schema: z.ZodType;
  skippable: boolean;
  /** Hidden steps are not counted in the progress bar. */
  visible?: (a: PartialAnswers) => boolean;
}

export const STEP_IDS = [
  'welcome', 'goal', 'basics', 'target', 'experience', 'availability', 'equipment',
  'injuries', 'activity', 'diet', 'allergies', 'budget', 'coachStyle', 'consents',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export const ONBOARDING_STEPS: readonly StepDef[] = [
  { id: 'welcome', screen: 1, schema: WelcomeSchema, skippable: false },
  { id: 'goal', screen: 2, schema: GoalSchema, skippable: false },
  { id: 'basics', screen: 3, schema: BasicsSchema, skippable: false },
  // Only for weight goals.
  { id: 'target', screen: 4, schema: TargetSchema, skippable: true, visible: (a) => a.goalType === 'cut' || a.goalType === 'bulk' },
  { id: 'experience', screen: 5, schema: ExperienceSchema, skippable: false },
  { id: 'availability', screen: 6, schema: AvailabilitySchema, skippable: false },
  { id: 'equipment', screen: 7, schema: EquipmentSchema, skippable: false },
  { id: 'injuries', screen: 8, schema: InjuriesSchema, skippable: true },
  { id: 'activity', screen: 9, schema: ActivitySchema, skippable: false },
  { id: 'diet', screen: 10, schema: DietSchema, skippable: false },
  { id: 'allergies', screen: 11, schema: AllergiesSchema, skippable: false },
  { id: 'budget', screen: 12, schema: BudgetSchema, skippable: true },
  { id: 'coachStyle', screen: 13, schema: CoachStyleSchema, skippable: true },
  { id: 'consents', screen: 14, schema: ConsentsSchema, skippable: false },
];

const byId = new Map(ONBOARDING_STEPS.map((s) => [s.id, s]));
export const getStep = (id: StepId): StepDef => byId.get(id)!;
export const isStepId = (v: unknown): v is StepId => typeof v === 'string' && byId.has(v as StepId);

export function visibleSteps(answers: PartialAnswers): StepDef[] {
  return ONBOARDING_STEPS.filter((s) => s.visible?.(answers) ?? true);
}

/** The first and last steps have no question: welcome is not counted as a question in the progress bar. */
export function nextStepId(answers: PartialAnswers, from: StepId): StepId | null {
  const list = visibleSteps(answers);
  const i = list.findIndex((s) => s.id === from);
  return i >= 0 && i < list.length - 1 ? list[i + 1].id : null;
}

export function prevStepId(answers: PartialAnswers, from: StepId): StepId | null {
  const list = visibleSteps(answers);
  const i = list.findIndex((s) => s.id === from);
  return i > 0 ? list[i - 1].id : null;
}

/** 1-based position among the visible steps, for the progress bar. */
export function progressOf(answers: PartialAnswers, id: StepId): { step: number; total: number } {
  const list = visibleSteps(answers);
  const i = list.findIndex((s) => s.id === id);
  return { step: Math.max(i, 0) + 1, total: list.length };
}

export interface StepValidation {
  ok: boolean;
  /** field → message key (issue code), for the UI to map to copy. */
  errors: Record<string, string>;
}

export function validateStep(id: StepId, answers: PartialAnswers): StepValidation {
  const r = getStep(id).schema.safeParse(answers);
  if (r.success) return { ok: true, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) errors[String(issue.path[0] ?? '_')] ??= issue.code;
  return { ok: false, errors };
}

/** First visible step whose answers are not valid yet (resume point). Skippable steps never block. */
export function firstIncompleteStep(answers: PartialAnswers): StepId | null {
  for (const s of visibleSteps(answers)) {
    if (!s.skippable && !validateStep(s.id, answers).ok) return s.id;
  }
  return null;
}

export const isComplete = (answers: PartialAnswers): boolean => OnboardingAnswersSchema.safeParse(answers).success;
