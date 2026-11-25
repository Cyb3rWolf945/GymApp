import { describe, expect, it } from 'vitest';
import { FREE_TEXT_MAX } from '../ai/guardrails.ts';
import { FIELD_RANGE, type PartialAnswers, type StepId, stepFieldErrors } from './index.ts';

const valid: PartialAnswers = {
  goalType: 'recomp', sex: 'male', age: 30, heightCm: 180, weightKg: 80, units: 'metric', experience: 'beginner',
  daysPerWeek: 3, sessionMinutes: 45, location: 'gym', equipment: ['full_gym'], contraindications: [], activity: 'light',
  diet: 'omnivore', mealsPerDay: 3, allergens: [], dislikes: [],
  consents: { terms: true, privacy: true, healthData: true, disclaimer: true, notifications: false },
};
const without = (...keys: (keyof PartialAnswers)[]): PartialAnswers => {
  const copy = { ...valid };
  for (const k of keys) delete copy[k];
  return copy;
};
const errs = (id: StepId, a: PartialAnswers) => stepFieldErrors(id, a).map((e) => `${e.field}:${e.reason}`);

describe('a valid step has no errors', () => {
  it.each(['goal', 'basics', 'target', 'experience', 'availability', 'equipment', 'injuries', 'activity', 'diet', 'allergies', 'budget', 'consents', 'welcome'] as StepId[])('%s', (id) => {
    expect(stepFieldErrors(id, valid)).toEqual([]);
  });
});

describe('missing answers, named by field', () => {
  it('goal', () => expect(errs('goal', without('goalType'))).toEqual(['goalType:missing']));
  it('basics: each field on its own', () => {
    expect(errs('basics', without('sex'))).toEqual(['sex:missing']);
    expect(errs('basics', without('age'))).toEqual(['age:missing']);
    expect(errs('basics', without('heightCm'))).toEqual(['heightCm:missing']);
    expect(errs('basics', without('weightKg'))).toEqual(['weightKg:missing']);
    expect(errs('basics', without('units'))).toEqual(['units:missing']);
  });
  it('basics: several missing at once, all reported, in screen order', () => {
    expect(errs('basics', without('units', 'sex', 'weightKg'))).toEqual(['sex:missing', 'weightKg:missing', 'units:missing']);
  });
  it('experience', () => expect(errs('experience', without('experience'))).toEqual(['experience:missing']));
  it('availability', () => {
    expect(errs('availability', without('daysPerWeek'))).toEqual(['daysPerWeek:missing']);
    expect(errs('availability', without('sessionMinutes'))).toEqual(['sessionMinutes:missing']);
  });
  it('equipment: nothing chosen, and an empty list', () => {
    expect(errs('equipment', without('location'))).toEqual(['location:missing']);
    expect(errs('equipment', without('equipment'))).toEqual(['equipment:missing']);
    expect(errs('equipment', { ...valid, equipment: [] })).toEqual(['equipment:missing']);
  });
  it('activity, diet', () => {
    expect(errs('activity', without('activity'))).toEqual(['activity:missing']);
    expect(errs('diet', without('diet'))).toEqual(['diet:missing']);
    expect(errs('diet', without('mealsPerDay'))).toEqual(['mealsPerDay:missing']);
  });
});

describe('out of range', () => {
  it('age', () => {
    expect(errs('basics', { ...valid, age: 5 })).toEqual(['age:too_small']);
    expect(errs('basics', { ...valid, age: 150 })).toEqual(['age:too_big']);
  });
  it('height and weight', () => {
    expect(errs('basics', { ...valid, heightCm: 20 })).toEqual(['heightCm:too_small']);
    expect(errs('basics', { ...valid, heightCm: 400 })).toEqual(['heightCm:too_big']);
    expect(errs('basics', { ...valid, weightKg: 5 })).toEqual(['weightKg:too_small']);
    expect(errs('basics', { ...valid, weightKg: 900 })).toEqual(['weightKg:too_big']);
  });
  it('target weight (optional: only a wrong value is an error)', () => {
    expect(errs('target', valid)).toEqual([]);
    expect(errs('target', { ...valid, targetWeightKg: 5 })).toEqual(['targetWeightKg:too_small']);
    expect(errs('target', { ...valid, targetWeightKg: 900 })).toEqual(['targetWeightKg:too_big']);
  });
  it('reference lifts, named by lift', () => {
    expect(errs('experience', { ...valid, referenceLifts: { squatKg: 5 } })).toEqual(['referenceLifts.squatKg:too_small']);
    expect(errs('experience', { ...valid, referenceLifts: { benchKg: 900 } })).toEqual(['referenceLifts.benchKg:too_big']);
    expect(errs('experience', { ...valid, referenceLifts: { deadliftKg: 600, squatKg: 100 } })).toEqual(['referenceLifts.deadliftKg:too_big']);
  });
  it('days a week', () => {
    expect(errs('availability', { ...valid, daysPerWeek: 1 })).toEqual(['daysPerWeek:too_small']);
    expect(errs('availability', { ...valid, daysPerWeek: 7 })).toEqual(['daysPerWeek:too_big']);
  });
  it('injury note too long (optional: empty is fine)', () => {
    expect(errs('injuries', valid)).toEqual([]);
    expect(errs('injuries', { ...valid, injuryNote: 'a'.repeat(FREE_TEXT_MAX) })).toEqual([]);
    expect(errs('injuries', { ...valid, injuryNote: 'a'.repeat(FREE_TEXT_MAX + 1) })).toEqual(['injuryNote:too_big']);
  });
  it('a value that is not one of the choices is invalid, not missing', () => {
    expect(errs('availability', { ...valid, sessionMinutes: 50 as never })).toEqual(['sessionMinutes:invalid']);
    expect(errs('goal', { ...valid, goalType: 'fly' as never })).toEqual(['goalType:invalid']);
  });
});

describe('consents: each unticked one is named', () => {
  it('all four missing', () => {
    expect(errs('consents', {})).toEqual(['consents.terms:missing', 'consents.privacy:missing', 'consents.healthData:missing', 'consents.disclaimer:missing']);
  });
  it('only the unticked ones', () => {
    expect(errs('consents', { ...valid, consents: { terms: true, privacy: false as never, healthData: true, disclaimer: false as never, notifications: false } })).toEqual(['consents.privacy:missing', 'consents.disclaimer:missing']);
  });
  it('all ticked', () => expect(errs('consents', valid)).toEqual([]));
});

describe('FIELD_RANGE', () => {
  it('has a range for every numeric field a message mentions', () => {
    for (const f of ['age', 'heightCm', 'weightKg', 'targetWeightKg', 'daysPerWeek', 'injuryNote', 'referenceLifts.squatKg', 'referenceLifts.benchKg', 'referenceLifts.deadliftKg']) {
      expect(FIELD_RANGE[f].max, f).toBeGreaterThan(FIELD_RANGE[f].min);
    }
  });
});
