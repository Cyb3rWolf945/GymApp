import type { PipelineResult } from './pipeline.ts';
import type { PlanKind } from './schemas.ts';

// Smoke test for a model profile: three synthetic profiles, each asked for a workout and a meal plan.
// Synthetic data only: never a real user. Run with `scripts/smoke-ai.ts` (dev: free models, prod: production only).

export interface SmokeProfile {
  name: string;
  /** A `profiles` row, as `buildPlanInputs` expects it. */
  row: Record<string, unknown>;
}

export const SMOKE_PROFILES: readonly SmokeProfile[] = [
  {
    name: 'cut, gym, no restrictions',
    row: { coach_style: 'calm', sex: 'male', birth_date: '1991-05-12', height_cm: 180, weight_kg: 88, experience: 'intermediate', onboarding: { goalType: 'cut', cutPace: 'moderate', targetWeightKg: 82, daysPerWeek: 4, sessionMinutes: 60, equipment: ['full_gym'], contraindications: [], diet: 'omnivore', allergens: [], activity: 'light' } },
  },
  {
    name: 'bulk, home dumbbells, vegetarian, nut allergy, knee care',
    row: { coach_style: 'direct', sex: 'female', birth_date: '1998-09-03', height_cm: 166, weight_kg: 58, experience: 'beginner', onboarding: { goalType: 'bulk', targetWeightKg: 62, daysPerWeek: 3, sessionMinutes: 45, equipment: ['dumbbells', 'bands'], contraindications: ['knee'], diet: 'vegetarian', allergens: ['nuts'], activity: 'moderate' } },
  },
  {
    name: 'recomp, basic gym, vegan, gluten and soy allergies, shoulder care',
    row: { coach_style: 'hype', sex: 'male', birth_date: '1985-02-20', height_cm: 175, weight_kg: 76, experience: 'advanced', onboarding: { goalType: 'recomp', daysPerWeek: 5, sessionMinutes: 60, equipment: ['basic_gym'], contraindications: ['shoulder'], diet: 'vegan', allergens: ['gluten', 'soy'], activity: 'active' } },
  },
];

export interface SmokeOutcome {
  profile: string;
  kind: PlanKind;
  /** Who produced the plan. A template means the models failed and the safe fallback was used. */
  source: PipelineResult['source'];
  attempts: number;
  /** The QA model reviewed the plan and passed it. */
  qaPassed: boolean;
  /** Errors from the deterministic validator (empty = the plan is valid). */
  validationErrors: string[];
  error?: string;
}

/** A plan passes only if a model made it (not the template), the validator finds nothing, and QA said yes. */
export const smokePassed = (o: SmokeOutcome): boolean => !o.error && o.source !== 'template' && o.validationErrors.length === 0 && o.qaPassed;

export function summarizeSmoke(outcomes: readonly SmokeOutcome[]): { passed: number; total: number; ok: boolean; lines: string[] } {
  const lines = outcomes.map(
    (o) => `${smokePassed(o) ? 'PASS' : 'FAIL'}  ${o.kind.padEnd(14)} ${o.profile}  source=${o.source} attempts=${o.attempts} qa=${o.qaPassed ? 'pass' : 'no'}${o.validationErrors.length ? ` validation=${o.validationErrors.length} errors` : ''}${o.error ? ` error=${o.error}` : ''}`,
  );
  const passed = outcomes.filter(smokePassed).length;
  return { passed, total: outcomes.length, ok: outcomes.length > 0 && passed === outcomes.length, lines };
}

/** Running the paid profile costs money (cents per plan): it needs an explicit yes. */
export function smokeGuard(profileName: string, env: { CONFIRM_PROD_SMOKE?: string | undefined }): string | null {
  if (profileName === 'prod' && env.CONFIRM_PROD_SMOKE !== 'yes') {
    return 'MODEL_PROFILE=prod uses paid models (about $0.01 per plan, 6 plans). Run it from the production environment with CONFIRM_PROD_SMOKE=yes.';
  }
  return null;
}
