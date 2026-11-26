import { describe, expect, it } from 'vitest';
import { OnboardingSchema, buildPlanInputs } from '../ai/generate';
import {
  ONBOARDING_STEPS, OnboardingAnswersSchema, STEP_IDS, TrackEventSchema, firstIncompleteStep, isComplete,
  nextStepId, prevStepId, previewTargets, progressOf, stepEvent, toProfileUpdate, validateStep, visibleSteps, type PartialAnswers,
} from './index';

const full: PartialAnswers = {
  goalType: 'cut', sex: 'female', age: 30, heightCm: 168, weightKg: 70, units: 'metric',
  targetWeightKg: 64, cutPace: 'slow', experience: 'beginner', daysPerWeek: 3, sessionMinutes: 45,
  location: 'home', equipment: ['dumbbells', 'bands'], contraindications: ['knee'], injuryNote: 'Old sprain.',
  activity: 'light', diet: 'vegetarian', mealsPerDay: 4, allergens: ['nuts'], dislikes: ['olives'],
  consents: { terms: true, privacy: true, healthData: true, disclaimer: true, notifications: false },
};

describe('steps', () => {
  it('has the 14 screens in order (the 13 of the spec, plus the optional coach style before consents)', () => {
    expect(ONBOARDING_STEPS.map((s) => s.screen)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([...STEP_IDS]);
  });
  it('marks target, injuries, budget and coach style as skippable (and only those)', () => {
    expect(ONBOARDING_STEPS.filter((s) => s.skippable).map((s) => s.id)).toEqual(['target', 'injuries', 'budget', 'coachStyle']);
  });
  it('shows the target screen only for weight goals', () => {
    expect(visibleSteps({ goalType: 'cut' }).map((s) => s.id)).toContain('target');
    expect(visibleSteps({ goalType: 'bulk' }).map((s) => s.id)).toContain('target');
    expect(visibleSteps({ goalType: 'recomp' }).map((s) => s.id)).not.toContain('target');
    expect(visibleSteps({}).map((s) => s.id)).not.toContain('target');
  });
  it('navigates forward and back, skipping hidden steps', () => {
    expect(nextStepId({ goalType: 'recomp' }, 'basics')).toBe('experience');
    expect(nextStepId({ goalType: 'cut' }, 'basics')).toBe('target');
    expect(prevStepId({ goalType: 'recomp' }, 'experience')).toBe('basics');
    expect(prevStepId({}, 'welcome')).toBeNull();
    expect(nextStepId({}, 'consents')).toBeNull();
  });
  it('reports progress over the visible steps', () => {
    expect(progressOf({ goalType: 'recomp' }, 'welcome')).toEqual({ step: 1, total: 13 });
    expect(progressOf({ goalType: 'cut' }, 'consents')).toEqual({ step: 14, total: 14 });
  });
});

describe('validation', () => {
  it('requires the right fields per screen', () => {
    expect(validateStep('goal', {}).ok).toBe(false);
    expect(validateStep('goal', { goalType: 'bulk' }).ok).toBe(true);
    expect(validateStep('basics', { sex: 'male', age: 5, heightCm: 180, weightKg: 80, units: 'metric' }).errors).toHaveProperty('age');
    expect(validateStep('availability', { daysPerWeek: 7, sessionMinutes: 45 }).errors).toHaveProperty('daysPerWeek');
    expect(validateStep('availability', { daysPerWeek: 3, sessionMinutes: 50 as never }).errors).toHaveProperty('sessionMinutes');
    expect(validateStep('equipment', { location: 'home', equipment: [] }).ok).toBe(false);
  });
  it('lets skippable screens pass empty', () => {
    for (const id of ['target', 'injuries', 'budget', 'coachStyle'] as const) expect(validateStep(id, {}).ok).toBe(true);
  });
  it('limits the injury note to 280 chars', () => {
    expect(validateStep('injuries', { injuryNote: 'a'.repeat(280) }).ok).toBe(true);
    expect(validateStep('injuries', { injuryNote: 'a'.repeat(281) }).ok).toBe(false);
  });
  it('rejects unknown enum values (allergens, equipment)', () => {
    expect(validateStep('allergies', { allergens: ['kryptonite' as never] }).ok).toBe(false);
    expect(validateStep('equipment', { location: 'home', equipment: ['jetpack' as never] }).ok).toBe(false);
  });
  it('needs explicit consent for terms, privacy and health data', () => {
    const c = (o: object) => ({ consents: { terms: true, privacy: true, healthData: true, disclaimer: true, ...o } }) as unknown as PartialAnswers;
    expect(validateStep('consents', c({})).ok).toBe(true);
    for (const k of ['terms', 'privacy', 'healthData', 'disclaimer']) expect(validateStep('consents', c({ [k]: false })).ok, k).toBe(false);
    expect(validateStep('consents', {}).ok).toBe(false);
  });
  it('finds the resume point and completeness', () => {
    expect(firstIncompleteStep({})).toBe('goal');
    expect(firstIncompleteStep({ goalType: 'cut', sex: 'male', age: 30, heightCm: 180, weightKg: 80, units: 'metric' })).toBe('experience');
    expect(firstIncompleteStep(full)).toBeNull();
    expect(isComplete(full)).toBe(true);
    expect(isComplete({ ...full, consents: undefined })).toBe(false);
  });
});

describe('profile mapping', () => {
  it('maps answers to a profiles update (metric, approximate birth date)', () => {
    const p = toProfileUpdate(full, new Date('2026-11-25T00:00:00Z'));
    expect(p).toMatchObject({ sex: 'female', birth_date: '1996-07-01', height_cm: 168, weight_kg: 70, goal: 'cut', experience: 'beginner', units: 'metric' });
  });
  it('writes onboarding JSON the plan generator can read', () => {
    const { onboarding } = toProfileUpdate(full);
    const gen = OnboardingSchema.parse(onboarding);
    expect(gen).toMatchObject({ goalType: 'cut', cutPace: 'slow', activity: 'light', daysPerWeek: 3, sessionMinutes: 45, equipment: ['dumbbells', 'bands'], contraindications: ['knee'], allergens: ['nuts'], diet: 'vegetarian' });
    expect(onboarding.injuryNote).toBe('Old sprain.');
    expect(onboarding.version).toBe(1);
  });
  it('refuses incomplete answers and keeps allergens even when empty', () => {
    expect(() => toProfileUpdate({ goalType: 'cut' })).toThrow();
    expect(toProfileUpdate({ ...full, allergens: [] }).onboarding.allergens).toEqual([]);
  });
  it('the full schema is exactly the union of the screens', () => {
    expect(OnboardingAnswersSchema.safeParse(full).success).toBe(true);
  });
});

describe('analytics', () => {
  it('accepts only onboarding funnel events with primitive props', () => {
    const ok = { anonId: 'abcdefgh-1234', ...stepEvent('onboarding_step_viewed', 'goal', 2, 1) };
    expect(TrackEventSchema.safeParse(ok).success).toBe(true);
    expect(TrackEventSchema.safeParse({ ...ok, name: 'drop_table' }).success).toBe(false);
    expect(TrackEventSchema.safeParse({ ...ok, props: { nested: { a: 1 } } }).success).toBe(false);
  });
  it('step events carry the step, never answers', () => {
    expect(stepEvent('onboarding_step_completed', 'basics', 3, 1).props).toEqual({ step: 'basics', screen: 3, version: 1 });
  });
});

describe('previewTargets (live calories and macros)', () => {
  it('waits for the answers that decide it', () => {
    expect(previewTargets({})).toBeNull();
    for (const missing of ['goalType', 'sex', 'age', 'heightCm', 'weightKg', 'activity'] as const) {
      const a = { ...full };
      delete a[missing];
      expect(previewTargets(a), missing).toBeNull();
    }
  });
  it('is the number the plan will use: the rest-day target from the real calc', () => {
    const p = previewTargets(full)!;
    const row = { id: 'u', ...toProfileUpdate(full, new Date('2026-11-25T00:00:00Z')) } as never;
    const rest = buildPlanInputs(row, new Date('2026-11-25T00:00:00Z')).targets.rest;
    expect(p).toEqual({ kcal: rest.kcal, proteinG: rest.proteinG, carbsG: rest.carbsG, fatG: rest.fatG });
  });
  it('changes as answers change: more activity, more calories; a bulk is above a cut', () => {
    expect(previewTargets({ ...full, activity: 'very_active' })!.kcal).toBeGreaterThan(previewTargets({ ...full, activity: 'sedentary' })!.kcal);
    expect(previewTargets({ ...full, goalType: 'bulk' })!.kcal).toBeGreaterThan(previewTargets({ ...full, goalType: 'cut' })!.kcal);
  });
  it('defaults the cut pace to moderate and the days to 3, like the plan', () => {
    const noDays = { ...full, cutPace: undefined, daysPerWeek: undefined };
    expect(previewTargets(noDays)).toEqual(previewTargets({ ...full, cutPace: 'moderate', daysPerWeek: 3 }));
  });
  it('never throws on nonsense: it has nothing to show', () => {
    expect(previewTargets({ ...full, weightKg: -5 })).toBeNull();
  });
});
