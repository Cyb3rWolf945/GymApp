import { FREE_TEXT_MAX } from '../ai/guardrails.ts';
import { type StepId, getStep } from './flow.ts';
import { Limits, type PartialAnswers } from './schema.ts';

// What is wrong on an onboarding step, field by field. The screens turn these into sentences (copy lives in the app)
// and show each one under its own field. Pure, so every field and reason is unit-tested.

/** `missing`: nothing chosen or typed yet. `too_small` / `too_big`: a number or text outside its range. `invalid`: anything else. */
export type FieldErrorReason = 'missing' | 'too_small' | 'too_big' | 'invalid';

export interface FieldError {
  step: StepId;
  /** The answer it belongs to: `sex`, `age`, `referenceLifts.squatKg`, `consents.privacy`. */
  field: string;
  reason: FieldErrorReason;
}

/** The accepted range of each numeric field, for messages like "Age must be between 14 and 100". */
export const FIELD_RANGE: Record<string, { min: number; max: number }> = {
  age: Limits.age,
  heightCm: Limits.heightCm,
  weightKg: Limits.weightKg,
  targetWeightKg: Limits.weightKg,
  daysPerWeek: Limits.days,
  injuryNote: { min: 0, max: FREE_TEXT_MAX },
  'referenceLifts.squatKg': { min: 20, max: 500 },
  'referenceLifts.benchKg': { min: 20, max: 500 },
  'referenceLifts.deadliftKg': { min: 20, max: 500 },
};

export const CONSENT_KEYS = ['terms', 'privacy', 'healthData', 'disclaimer'] as const;

const valueAt = (answers: PartialAnswers, path: readonly string[]): unknown =>
  path.reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), answers);

const isMissing = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Every field that stops this step from being valid, in screen order, one entry per field. Empty when the step is valid. */
export function stepFieldErrors(id: StepId, answers: PartialAnswers): FieldError[] {
  if (id === 'consents') {
    return CONSENT_KEYS.filter((k) => answers.consents?.[k] !== true).map((k) => ({ step: id, field: `consents.${k}`, reason: 'missing' as const }));
  }
  const parsed = getStep(id).schema.safeParse(answers);
  if (parsed.success) return [];
  const seen = new Set<string>();
  const errors: FieldError[] = [];
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String);
    const field = path.join('.') || '_';
    if (seen.has(field)) continue;
    seen.add(field);
    const reason: FieldErrorReason = isMissing(valueAt(answers, path)) ? 'missing' : issue.code === 'too_small' ? 'too_small' : issue.code === 'too_big' ? 'too_big' : 'invalid';
    errors.push({ step: id, field, reason });
  }
  return errors;
}
