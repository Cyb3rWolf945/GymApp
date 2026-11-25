import { describe, expect, it } from 'vitest';
import { FIELD_RANGE, type FieldError, type StepId } from '@gymapp/shared';
import { en } from '../copy/en';
import { fieldMessage, shownErrors, unitsOf } from './fieldMessages';

const err = (step: StepId, field: string, reason: FieldError['reason']): FieldError => ({ step, field, reason });
const msg = (step: StepId, field: string, reason: FieldError['reason'], units?: 'metric' | 'imperial') => fieldMessage(err(step, field, reason), units);

describe('missing: the sentence from the issue, per field', () => {
  it.each([
    ['goal', 'goalType', 'Choose your main goal.'],
    ['basics', 'sex', 'Choose male or female. We use it to estimate your calories.'],
    ['basics', 'age', 'Add your age.'],
    ['basics', 'heightCm', 'Add your height.'],
    ['basics', 'weightKg', 'Add your weight.'],
    ['basics', 'units', 'Choose metric or imperial.'],
    ['experience', 'experience', "Tell us how long you've been lifting."],
    ['availability', 'daysPerWeek', 'Choose how many days a week you can train.'],
    ['availability', 'sessionMinutes', 'Choose how long each workout can be.'],
    ['equipment', 'location', 'Choose where you train.'],
    ['equipment', 'equipment', 'Choose at least one piece of equipment.'],
    ['activity', 'activity', 'Choose how active you are outside workouts.'],
    ['diet', 'diet', 'Choose how you like to eat.'],
    ['diet', 'mealsPerDay', 'Choose how many meals a day you want.'],
    ['consents', 'consents.terms', 'Accept the terms to continue.'],
    ['consents', 'consents.privacy', 'Accept the privacy policy to continue.'],
    ['consents', 'consents.healthData', 'Accept the health data consent to continue.'],
    ['consents', 'consents.disclaimer', 'Accept the health disclaimer to continue.'],
  ] as [StepId, string, string][])('%s / %s', (step, field, text) => {
    expect(msg(step, field, 'missing')).toBe(text);
  });
});

describe('out of range: ranges come from Limits, not from the copy', () => {
  it('age', () => {
    expect(msg('basics', 'age', 'too_small')).toBe(`Age must be between ${FIELD_RANGE.age.min} and ${FIELD_RANGE.age.max}.`);
    expect(msg('basics', 'age', 'too_big')).toBe('Age must be between 14 and 100.');
  });
  it('height, metric and imperial', () => {
    expect(msg('basics', 'heightCm', 'too_big')).toBe('Height must be between 100 and 250 cm.');
    expect(msg('basics', 'heightCm', 'too_big', 'imperial')).toBe('Height must be between 3′ 3″ and 8′ 2″.');
  });
  it('weight, kg and lb', () => {
    expect(msg('basics', 'weightKg', 'too_small')).toBe('Weight must be between 30 and 400 kg.');
    expect(msg('basics', 'weightKg', 'too_small', 'imperial')).toBe('Weight must be between 66 and 882 lb.');
  });
  it('target weight', () => {
    expect(msg('target', 'targetWeightKg', 'too_big')).toBe('Target weight must be between 30 and 400 kg.');
    expect(msg('target', 'targetWeightKg', 'too_big', 'imperial')).toBe('Target weight must be between 66 and 882 lb.');
  });
  it('reference lifts name the lift', () => {
    expect(msg('experience', 'referenceLifts.squatKg', 'too_big')).toBe('Squat must be between 20 and 500 kg.');
    expect(msg('experience', 'referenceLifts.benchKg', 'too_small')).toBe('Bench press must be between 20 and 500 kg.');
    expect(msg('experience', 'referenceLifts.deadliftKg', 'too_big')).toBe('Deadlift must be between 20 and 500 kg.');
  });
  it('days a week', () => {
    expect(msg('availability', 'daysPerWeek', 'too_big')).toBe('Choose between 2 and 6 days.');
  });
  it('injury note length', () => {
    expect(msg('injuries', 'injuryNote', 'too_big')).toBe('Keep the note under 280 characters.');
  });
});

describe('unknown fields', () => {
  it('have no specific message', () => {
    expect(msg('basics', 'somethingNew', 'invalid')).toBeNull();
  });
  it('shownErrors splits them out, so the screen can report them (step and field only)', () => {
    const { shown, unknown } = shownErrors([err('basics', 'sex', 'missing'), err('basics', 'somethingNew', 'invalid')], 'metric');
    expect(shown).toEqual([{ field: 'sex', message: en.onboarding.fieldErrors.sex.missing }]);
    expect(unknown).toEqual([err('basics', 'somethingNew', 'invalid')]);
  });
});

describe('every message follows the writing guide', () => {
  it('is short, in the second person where it addresses you, and never blames', () => {
    const all = [
      ...['goalType', 'sex', 'age', 'heightCm', 'weightKg', 'units', 'experience', 'daysPerWeek', 'sessionMinutes', 'location', 'equipment', 'activity', 'diet', 'mealsPerDay'].map((f) => msg('basics', f, 'missing')),
      ...['consents.terms', 'consents.privacy', 'consents.healthData', 'consents.disclaimer'].map((f) => msg('consents', f, 'missing')),
      en.onboarding.fieldErrors.generic,
    ];
    for (const text of all) {
      expect(text, String(text)).toBeTruthy();
      expect(text!.length).toBeLessThan(90);
      expect(text).not.toMatch(/\b(wrong|invalid|error|failed|your fault|must not)\b/i);
    }
  });
});

describe('unitsOf', () => {
  it('is metric until imperial is chosen', () => {
    expect(unitsOf({})).toBe('metric');
    expect(unitsOf({ units: 'imperial' })).toBe('imperial');
  });
});
