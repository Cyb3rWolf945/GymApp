import { describe, expect, it } from 'vitest';
import {
  FREE_GENERATIONS, GENERATION_TIMEOUT_MS, STALE_JOB_MS, buildPreview, canGenerate, deriveProgress, effectiveStatus, formatReps, generationTimedOut, isEntitled, isInFlight,
  isStaleJob, latestJobs, pollDelayMs, usedStarterPlan, type JobRow, type RecipeCandidate,
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
  it('waits about 3 minutes at most, so the retry state always comes, and a failed job shows at once', () => {
    expect(GENERATION_TIMEOUT_MS).toBe(180_000);
    // Failed right away, whatever the clock says: no waiting out the timeout on a job the server already ended.
    expect(deriveProgress([job('workout_plan', 'failed'), job('nutrition_plan', 'running')], T0, T0 + 1).phase).toBe('failed');
    expect(deriveProgress([job('workout_plan', 'running'), job('nutrition_plan', 'failed')], T0, T0 + 1).phase).toBe('failed');
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
    const now = Date.parse('2026-11-25T00:01:00Z');
    expect(isInFlight(job('workout_plan', 'queued'), now)).toBe(true);
    expect(isInFlight(job('workout_plan', 'running'), now)).toBe(true);
    expect(isInFlight(job('workout_plan', 'done'), now)).toBe(false);
    expect(isInFlight(undefined, now)).toBe(false);
  });
});

// E-64: a job whose function died stays `running` in the table. The app reads it as failed once it is past the stale limit.
describe('stale jobs', () => {
  const created = '2026-11-25T22:00:00Z';
  const t0 = Date.parse(created);
  it('a fresh job is waited on, a stale one is dead', () => {
    expect(isStaleJob(job('nutrition_plan', 'running', created), t0 + STALE_JOB_MS - 1)).toBe(false);
    expect(isStaleJob(job('nutrition_plan', 'running', created), t0 + STALE_JOB_MS + 1)).toBe(true);
    expect(isInFlight(job('nutrition_plan', 'running', created), t0 + 60_000)).toBe(true);
    expect(isInFlight(job('nutrition_plan', 'running', created), t0 + STALE_JOB_MS + 1)).toBe(false);
    expect(isInFlight(job('nutrition_plan', 'queued', created), t0 + STALE_JOB_MS + 1)).toBe(false);
  });
  it('done and failed jobs are never stale', () => {
    for (const status of ['done', 'failed'] as const) expect(isStaleJob(job('workout_plan', status, created), t0 + 10 * STALE_JOB_MS)).toBe(false);
    expect(effectiveStatus(job('workout_plan', 'done', created), t0 + 10 * STALE_JOB_MS)).toBe('done');
    expect(effectiveStatus(undefined, t0)).toBeUndefined();
  });
  it('the screen ends in the error state, not an endless spinner: workout done, nutrition stuck "running"', () => {
    const rows = [job('workout_plan', 'done', created), job('nutrition_plan', 'running', created)];
    expect(deriveProgress(rows, t0, t0 + 60_000).phase).toBe('running');
    expect(deriveProgress(rows, t0, t0 + STALE_JOB_MS + 1).phase).toBe('failed');
  });
  it('mixed: a dead old job does not hide the new one that replaced it', () => {
    const rows = [job('nutrition_plan', 'running', created), job('nutrition_plan', 'queued', '2026-11-25T22:09:00Z'), job('workout_plan', 'done', '2026-11-25T22:09:00Z')];
    const now = Date.parse('2026-11-25T22:09:30Z');
    expect(deriveProgress(rows, now - 30_000, now).phase).toBe('running'); // the new nutrition job is alive
    expect(deriveProgress(rows, now - 30_000, now + 100_000).phase).toBe('running');
    expect(deriveProgress(rows, now - 30_000, now + STALE_JOB_MS + 1).phase).toBe('failed');
  });
});

describe('the timeout and the polling gaps', () => {
  it('times out 3 minutes after the attempt started, and only then', () => {
    expect(generationTimedOut(T0, T0 + GENERATION_TIMEOUT_MS)).toBe(false);
    expect(generationTimedOut(T0, T0 + GENERATION_TIMEOUT_MS + 1)).toBe(true);
    // A later "start" (a re-run of the effect) would move the deadline: the caller keeps the first one.
    expect(generationTimedOut(T0, T0 + GENERATION_TIMEOUT_MS + 1)).not.toBe(generationTimedOut(T0 + 120_000, T0 + GENERATION_TIMEOUT_MS + 1));
  });
  it('polls every 2 s, then 3 s, then every 5 s', () => {
    expect([0, 1, 2, 3, 10, 1000].map(pollDelayMs)).toEqual([2000, 3000, 5000, 5000, 5000, 5000]);
    expect(pollDelayMs(-1)).toBe(2000);
    expect(pollDelayMs(1.9)).toBe(3000);
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

describe('starter plan notice (E-64)', () => {
  it('is shown when any plan is the template fallback, and only then', () => {
    expect(usedStarterPlan({ source: 'template' }, { source: 'planner' })).toBe(true);
    expect(usedStarterPlan({ source: 'planner' }, { source: 'template' })).toBe(true);
    expect(usedStarterPlan({ source: 'planner' }, { source: 'escalation' })).toBe(false);
    for (const bad of [undefined, null, 'template', 3, {}]) expect(usedStarterPlan(bad)).toBe(false);
  });
});
