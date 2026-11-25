import { describe, expect, it } from 'vitest';
import { type PartialAnswers, EDITABLE_STEPS, answersFromProfile, changedFields, isEditableStep, planOutdatedBy, profileRows, profileUpdateAfterEdit, toProfileUpdate } from './index.ts';

const answers: PartialAnswers = {
  goalType: 'recomp', sex: 'male', age: 30, heightCm: 180, weightKg: 80, units: 'metric', experience: 'beginner',
  daysPerWeek: 3, sessionMinutes: 45, preferredDays: ['mon', 'thu'], location: 'gym', equipment: ['full_gym'],
  contraindications: [], activity: 'light', diet: 'omnivore', mealsPerDay: 3, allergens: [], dislikes: [],
  consents: { terms: true, privacy: true, healthData: true, disclaimer: true, notifications: false },
};

describe('profileRows', () => {
  it('lists every question of onboarding except welcome and consents', () => {
    const rows = profileRows({ ...answers, goalType: 'cut' });
    expect(rows).toEqual(['goal', 'basics', 'target', 'experience', 'availability', 'equipment', 'injuries', 'activity', 'diet', 'allergies', 'budget']);
    expect(rows).not.toContain('welcome');
    expect(rows).not.toContain('consents');
  });
  it('hides the target row for a recomp goal, like onboarding does', () => {
    expect(profileRows(answers)).not.toContain('target');
    expect(profileRows({ ...answers, goalType: 'bulk' })).toContain('target');
  });
  it('only those steps can be edited by route', () => {
    expect(isEditableStep('equipment')).toBe(true);
    expect(isEditableStep('consents')).toBe(false);
    expect(isEditableStep('welcome')).toBe(false);
    expect(isEditableStep('nope')).toBe(false);
    expect(isEditableStep(undefined)).toBe(false);
    expect(EDITABLE_STEPS).toContain('target');
  });
});

describe('answersFromProfile', () => {
  it('reads what onboarding stored, without its version', () => {
    const stored = { ...toProfileUpdate(answers).onboarding };
    expect(stored.version).toBe(1);
    const back = answersFromProfile(stored);
    expect(back).toEqual(expect.objectContaining({ goalType: 'recomp', equipment: ['full_gym'], daysPerWeek: 3 }));
    expect('version' in back).toBe(false);
  });
  it('is empty for nothing, and drops invalid values instead of throwing', () => {
    expect(answersFromProfile(null)).toEqual({});
    expect(answersFromProfile(undefined)).toEqual({});
    expect(answersFromProfile('x')).toEqual({});
    expect(answersFromProfile({ goalType: 'fly', age: 'old' })).toEqual({});
  });
});

describe('which changes make the plan outdated', () => {
  const outdated = (patch: PartialAnswers) => planOutdatedBy(answers, { ...answers, ...patch });
  it.each([
    ['goal', { goalType: 'bulk' }],
    ['sex', { sex: 'female' }],
    ['age', { age: 31 }],
    ['height', { heightCm: 181 }],
    ['weight', { weightKg: 79 }],
    ['experience', { experience: 'intermediate' }],
    ['days per week', { daysPerWeek: 4 }],
    ['session minutes', { sessionMinutes: 60 }],
    ['preferred days', { preferredDays: ['tue', 'fri'] }],
    ['equipment', { equipment: ['dumbbells'], location: 'home' }],
    ['injuries', { contraindications: ['knee'] }],
    ['injury note', { injuryNote: 'old ankle sprain' }],
    ['activity', { activity: 'active' }],
    ['diet', { diet: 'vegan' }],
    ['meals a day', { mealsPerDay: 4 }],
    ['allergies', { allergens: ['peanuts'] }],
    ['foods to skip', { dislikes: ['mushrooms'] }],
    ['budget', { budget: 'low' }],
    ['cooking time', { cookingMinutes: 15 }],
    ['target weight', { targetWeightKg: 75 }],
  ] as [string, PartialAnswers][])('%s marks it outdated', (_name, patch) => {
    expect(outdated(patch)).toBe(true);
  });
  it('units alone do not', () => {
    expect(outdated({ units: 'imperial' })).toBe(false);
  });
  it('consents alone do not', () => {
    expect(outdated({ consents: { terms: true, privacy: true, healthData: true, disclaimer: true, notifications: true } })).toBe(false);
  });
  it('saving the same answers again does not', () => {
    expect(planOutdatedBy(answers, { ...answers })).toBe(false);
  });
  it('the order of days and equipment does not matter', () => {
    expect(planOutdatedBy(answers, { ...answers, preferredDays: ['thu', 'mon'] })).toBe(false);
  });
  it('an empty list and a missing value are the same thing', () => {
    expect(planOutdatedBy({ ...answers, dislikes: undefined }, { ...answers, dislikes: [] })).toBe(false);
    expect(planOutdatedBy({ ...answers, injuryNote: undefined }, { ...answers, injuryNote: undefined })).toBe(false);
  });
  it('a change to units and to the plan together still counts', () => {
    expect(outdated({ units: 'imperial', diet: 'vegan' })).toBe(true);
  });
  it('lists what changed', () => {
    expect(changedFields(answers, { ...answers, units: 'imperial', diet: 'vegan' })).toEqual(['diet', 'units']);
    expect(changedFields(answers, answers)).toEqual([]);
  });
});

describe('profileUpdateAfterEdit', () => {
  it('keeps the other answers and writes the same shape onboarding writes', () => {
    const update = profileUpdateAfterEdit(answers, { diet: 'vegan' }, new Date('2026-11-25T00:00:00Z'));
    expect(update.onboarding).toMatchObject({ diet: 'vegan', equipment: ['full_gym'], goalType: 'recomp', version: 1 });
    expect(update).toMatchObject({ sex: 'male', goal: 'recomp', units: 'metric', height_cm: 180, weight_kg: 80, birth_date: '1996-07-01' });
  });
  it('an edit to the basics updates the profile columns', () => {
    const update = profileUpdateAfterEdit(answers, { weightKg: 77.5, units: 'imperial' });
    expect(update).toMatchObject({ weight_kg: 77.5, units: 'imperial' });
  });
  it('throws instead of writing an invalid profile', () => {
    expect(() => profileUpdateAfterEdit(answers, { age: 3 })).toThrow();
    expect(() => profileUpdateAfterEdit(answers, { equipment: [] })).toThrow();
    expect(() => profileUpdateAfterEdit({}, { diet: 'vegan' })).toThrow();
  });
});
