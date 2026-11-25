import { ONBOARDING_STEPS, type StepId } from './flow.ts';
import { type ProfileUpdate, toProfileUpdate } from './profile.ts';
import { OnboardingAnswersSchema, type PartialAnswers } from './schema.ts';

// Editing the profile after onboarding. The edit screens reuse the onboarding step components and `validateStep`; this
// file holds the rules around them: which rows exist, how the stored answers come back, and which changes make the
// plan out of date. Pure, so it is unit-tested.

/** The rows of "Your profile", in order: every onboarding step that asks a question, except consents (they have their own screens). */
export function profileRows(answers: PartialAnswers): StepId[] {
  return ONBOARDING_STEPS.filter((s) => s.id !== 'welcome' && s.id !== 'consents' && (s.visible?.(answers) ?? true)).map((s) => s.id);
}

/** Rows a person may edit: the same set, regardless of the current answers (used to check a route param). */
export const EDITABLE_STEPS: readonly StepId[] = ONBOARDING_STEPS.filter((s) => s.id !== 'welcome' && s.id !== 'consents').map((s) => s.id);
export const isEditableStep = (v: unknown): v is StepId => typeof v === 'string' && (EDITABLE_STEPS as readonly string[]).includes(v);

/** The answers stored in `profiles.onboarding`, ready for the step components. Anything that is not a valid answer is dropped. */
export function answersFromProfile(onboarding: unknown): PartialAnswers {
  if (!onboarding || typeof onboarding !== 'object') return {};
  const { version: _version, ...rest } = onboarding as Record<string, unknown>;
  const parsed = OnboardingAnswersSchema.partial().safeParse(rest);
  return parsed.success ? parsed.data : {};
}

/** Fields that never change what the plan looks like: the units are a display choice, consents are records. */
const NOT_ABOUT_THE_PLAN = new Set(['units', 'consents']);

const isEmpty = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown): boolean => {
  if (isEmpty(a) && isEmpty(b)) return true;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
};
/** Key order and array order of day/equipment lists don't matter. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return [...v].map(canonical).sort((x, y) => String(JSON.stringify(x)).localeCompare(String(JSON.stringify(y))));
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => !isEmpty(x))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, canonical(x)]),
    );
  }
  return v;
}

/** The answer fields that changed between two sets of answers. */
export function changedFields(before: PartialAnswers, after: PartialAnswers): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => !same((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k])).sort();
}

/** True when an edit changes something the plan is built from (everything except the units): the plan is then out of date. */
export function planOutdatedBy(before: PartialAnswers, after: PartialAnswers): boolean {
  return changedFields(before, after).some((k) => !NOT_ABOUT_THE_PLAN.has(k));
}

/**
 * What to write to `profiles` after an edit: the stored answers with the edited ones on top, as the same
 * `ProfileUpdate` onboarding writes. Throws if the result is not a complete set of answers.
 */
export function profileUpdateAfterEdit(stored: PartialAnswers, edited: PartialAnswers, now = new Date()): ProfileUpdate {
  return toProfileUpdate({ ...stored, ...edited }, now);
}
