import { FIELD_RANGE, type FieldError, type PartialAnswers, cmToFtIn, kgToLb } from '@gymapp/shared';
import { en } from '../copy/en';

const m = en.onboarding.fieldErrors;
type Units = 'metric' | 'imperial';

const feetInches = (cm: number) => {
  const { feet, inches } = cmToFtIn(cm);
  return `${feet}′ ${Math.round(inches)}″`;
};

/**
 * The sentence for one field error, in the person's units. `null` = no specific message for this one (the screen then
 * shows a generic line and reports `onboarding_validation_unknown`, with the step and field only).
 */
export function fieldMessage(error: FieldError, units: Units = 'metric'): string | null {
  const { field, reason } = error;
  const range = FIELD_RANGE[field];
  const missing = reason === 'missing';
  const imperial = units === 'imperial';
  switch (field) {
    case 'goalType': return m.goalType.missing;
    case 'sex': return m.sex.missing;
    case 'units': return m.units.missing;
    case 'age': return missing ? m.age.missing : m.age.range(range.min, range.max);
    case 'heightCm':
      if (missing) return m.heightCm.missing;
      return imperial ? m.heightCm.rangeImperial(feetInches(range.min), feetInches(range.max)) : m.heightCm.range(range.min, range.max);
    case 'weightKg':
      if (missing) return m.weightKg.missing;
      return imperial ? m.weightKg.rangeImperial(Math.round(kgToLb(range.min)), Math.round(kgToLb(range.max))) : m.weightKg.range(range.min, range.max);
    case 'targetWeightKg':
      return imperial ? m.targetWeightKg.rangeImperial(Math.round(kgToLb(range.min)), Math.round(kgToLb(range.max))) : m.targetWeightKg.range(range.min, range.max);
    case 'experience': return m.experience.missing;
    case 'referenceLifts.squatKg': return m.lift(m.lifts.squat, range.min, range.max);
    case 'referenceLifts.benchKg': return m.lift(m.lifts.bench, range.min, range.max);
    case 'referenceLifts.deadliftKg': return m.lift(m.lifts.deadlift, range.min, range.max);
    case 'daysPerWeek': return missing ? m.daysPerWeek.missing : m.daysPerWeek.range(range.min, range.max);
    case 'sessionMinutes': return m.sessionMinutes.missing;
    case 'location': return m.location.missing;
    case 'equipment': return m.equipment.missing;
    case 'injuryNote': return m.injuryNote.tooLong(range.max);
    case 'activity': return m.activity.missing;
    case 'diet': return m.diet.missing;
    case 'mealsPerDay': return m.mealsPerDay.missing;
    case 'consents.terms': return m.consents.terms;
    case 'consents.privacy': return m.consents.privacy;
    case 'consents.healthData': return m.consents.healthData;
    case 'consents.disclaimer': return m.consents.disclaimer;
    default: return null;
  }
}

/** The units the person is using (metric until they say otherwise). */
export const unitsOf = (answers: PartialAnswers): Units => (answers.units === 'imperial' ? 'imperial' : 'metric');

export interface ShownError {
  field: string;
  message: string;
}

/** Messages for the fields that failed when Continue was pressed and are still wrong: each disappears once its field is valid. */
export function shownErrors(errors: FieldError[], units: Units): { shown: ShownError[]; unknown: FieldError[] } {
  const shown: ShownError[] = [];
  const unknown: FieldError[] = [];
  for (const e of errors) {
    const message = fieldMessage(e, units);
    if (message === null) unknown.push(e);
    else shown.push({ field: e.field, message });
  }
  return { shown, unknown };
}
