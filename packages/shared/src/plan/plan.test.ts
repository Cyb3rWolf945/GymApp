import { describe, expect, it } from 'vitest';
import {
  FREE_GENERATIONS, GENERATION_TIMEOUT_MS, buildPreview, canGenerate, deriveProgress, formatReps, isEntitled, isInFlight,
  latestJobs, type JobRow, type RecipeCandidate,
} from '../index';

const job = (kind: JobRow['kind'], status: JobRow['status'], created_at = '2026-11-25T00:00:00Z'): JobRow => ({ id: `${kind}-${status}-${created_at}`, kind, status, created_at });
const T0 = 1_000_000;

describe('deriveProgress', () => {
  it('starts with calories done and the rest waiting', () => {
    expect(deriveProgress([], T0, T0)).toEqual({ phase: 'running', steps: [{ id: 'calories', state: 'done' }, { id: 'exercises', state: 'pending' }, { id: 'meals', state: 'pending' }] });
  });
  it('follows the two jobs', () => {
    const p = deriveProgress([job('workout_plan', 'done'), job('nutrition_plan', 'running')], T0, T0 + 5000);
    expect(p.steps.map((s) => s.state)).toEqual(['done', 'done', 'active']);
    expect(p.phase).toBe('running');
  });
  it('is done only when both jobs are done', () => {
    expect(deriveProgress([job('workout_plan', 'done'), job('nutrition_plan', 'done')], T0, T0).phase).toBe('done');
    expect(deriveProgress([job('workout_plan', 'done')], T0, T0).phase).toBe('running');
  });
  it('fails when either job fails', () => {
    expect(deriveProgress([job('workout_plan', 'failed'), job('nutrition_plan', 'running')], T0, T0).phase).toBe('failed');
  });
  it('times out after the limit, but never once done', () => {
    expect(deriveProgress([job('workout_plan', 'running')], T0, T0 + GENERATION_TIMEOUT_MS).phase).toBe('running');
    expect(deriveProgress([job('workout_plan', 'running')], T0, T0 + GENERATION_TIMEOUT_MS + 1).phase).toBe('timeout');
    expect(deriveProgress([job('workout_plan', 'done'), job('nutrition_plan', 'done')], T0, T0 + 10 * GENERATION_TIMEOUT_MS).phase).toBe('done');
  });
  it('only looks at the newest job of each kind', () => {
    const rows = [job('workout_plan', 'failed', '2026-11-25T00:00:00Z'), job('workout_plan', 'running', '2026-11-25T00:05:00Z')];
    expect(latestJobs(rows).workout_plan?.status).toBe('running');
    expect(deriveProgress(rows, T0, T0).phase).toBe('running');
  });
  it('knows which jobs can be waited on', () => {
    expect(isInFlight(job('workout_plan', 'queued'))).toBe(true);
    expect(isInFlight(job('workout_plan', 'running'))).toBe(true);
    expect(isInFlight(job('workout_plan', 'done'))).toBe(false);
    expect(isInFlight(undefined)).toBe(false);
  });
});

describe('canGenerate (server-side access)', () => {
  it('entitled users can always generate', () => {
    expect(canGenerate(true, [{ status: 'done' }, { status: 'done' }])).toEqual({ allow: true });
  });
  it('others get one free generation per kind for the preview', () => {
    expect(FREE_GENERATIONS).toBe(1);
    expect(canGenerate(false, [])).toEqual({ allow: true });
    expect(canGenerate(false, [{ status: 'done' }])).toEqual({ allow: false, reason: 'needs_trial' });
    expect(canGenerate(false, [{ status: 'running' }])).toEqual({ allow: false, reason: 'needs_trial' });
  });
  it('a failed job does not use up the free generation', () => {
    expect(canGenerate(false, [{ status: 'failed' }, { status: 'failed' }])).toEqual({ allow: true });
  });
  it('isEntitled needs an active tier', () => {
    expect(isEntitled({ tier: 'pro', status: 'active' })).toBe(true);
    expect(isEntitled({ tier: 'pro', status: 'trialing' })).toBe(true);
    expect(isEntitled({ tier: 'none', status: 'active' })).toBe(false);
    expect(isEntitled({ tier: 'pro', status: 'canceled' })).toBe(false);
    expect(isEntitled(null)).toBe(false);
  });
});

const recipes: RecipeCandidate[] = [
  { slug: 'oats', name: 'Protein oats', diet: 'omnivore', kcal: 500, protein_g: 30, carbs_g: 60, fat_g: 12, allergens: [] },
  { slug: 'bowl', name: 'Chicken bowl', diet: 'omnivore', kcal: 700, protein_g: 50, carbs_g: 70, fat_g: 20, allergens: [] },
];
const workoutResult = {
  plan: { split: 'full_body', days: [{ name: 'Day 1', exercises: [{ exerciseSlug: 'squat', sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90 }, { exerciseSlug: 'row', sets: 3, repsMin: 10, repsMax: 10, rpe: 7, restSeconds: 60 }] }, { name: 'Day 2', exercises: [{ exerciseSlug: 'press', sets: 3, repsMin: 8, repsMax: 8, rpe: 7, restSeconds: 90 }] }], rationale: 'You train 2 days.' },
  guardrails: { conservative: false, disclaimer: null },
};
const nutritionResult = {
  plan: { days: [{ dayType: 'training', kcal: 2000, proteinG: 1, carbsG: 1, fatG: 1, meals: [{ name: 'Breakfast', recipeSlug: 'oats', portions: 1 }, { name: 'Dinner', recipeSlug: 'bowl', portions: 1.5 }] }], rationale: 'Protein stays high.' },
  guardrails: { conservative: true, disclaimer: 'Talk to a doctor.' },
};

describe('buildPreview', () => {
  const p = buildPreview(workoutResult, nutritionResult, new Map([['squat', 'Back squat']]), recipes);
  it('shows only the first workout, with names (slug as fallback) and rep ranges', () => {
    expect(p.workout?.dayName).toBe('Day 1');
    expect(p.workout?.exercises).toEqual([
      { slug: 'squat', name: 'Back squat', sets: 3, reps: '8–12', restSeconds: 90 },
      { slug: 'row', name: 'row', sets: 3, reps: '10', restSeconds: 60 },
    ]);
    expect(p.workout?.rationale).toBe('You train 2 days.');
  });
  it('computes meals and totals from the recipes, not the model numbers', () => {
    expect(p.meals?.meals).toEqual([
      { name: 'Breakfast', recipe: 'Protein oats', portions: 1, kcal: 500 },
      { name: 'Dinner', recipe: 'Chicken bowl', portions: 1.5, kcal: 1050 },
    ]);
    expect(p.meals?.totals).toEqual({ kcal: 1550, proteinG: 105, carbsG: 165, fatG: 42 });
  });
  it('carries the disclaimer when a red flag was seen', () => {
    expect(p.disclaimer).toBe('Talk to a doctor.');
  });
  it('returns nulls for missing or malformed results', () => {
    expect(buildPreview(null, { plan: { nope: 1 } }, new Map(), recipes)).toEqual({ workout: null, meals: null, disclaimer: null });
  });
  it('formats reps', () => {
    expect(formatReps(5, 5)).toBe('5');
    expect(formatReps(6, 10)).toBe('6–10');
  });
});
