import { describe, expect, it } from 'vitest';
import { buildPlanInputs } from './generate.ts';
import { MODEL_PROFILES, getRuntimeModelProfile } from './models.config.ts';
import { SMOKE_PROFILES, type SmokeOutcome, smokeGuard, smokePassed, summarizeSmoke } from './smoke.ts';

describe('smoke profiles', () => {
  it('are three synthetic profiles that turn into valid plan inputs', () => {
    expect(SMOKE_PROFILES).toHaveLength(3);
    for (const p of SMOKE_PROFILES) {
      const inputs = buildPlanInputs(p.row as never, new Date('2026-11-24'));
      expect(inputs.targets.training.kcal, p.name).toBeGreaterThan(1200);
    }
    const [, vegetarian, vegan] = SMOKE_PROFILES.map((p) => buildPlanInputs(p.row as never, new Date('2026-11-24')));
    expect(vegetarian.diet).toBe('vegetarian');
    expect(vegetarian.allergens).toContain('nuts');
    expect(vegan.diet).toBe('vegan');
    expect(vegan.contraindications).toContain('shoulder');
  });
});

const ok = (over: Partial<SmokeOutcome> = {}): SmokeOutcome => ({ profile: 'p', kind: 'workout_plan', source: 'planner', attempts: 1, qaPassed: true, validationErrors: [], ...over });

describe('smoke results', () => {
  it('passes only for a model-made, valid, QA-approved plan', () => {
    expect(smokePassed(ok())).toBe(true);
    expect(smokePassed(ok({ source: 'escalation' }))).toBe(true);
    expect(smokePassed(ok({ source: 'template' }))).toBe(false);
    expect(smokePassed(ok({ qaPassed: false }))).toBe(false);
    expect(smokePassed(ok({ validationErrors: ['x'] }))).toBe(false);
    expect(smokePassed(ok({ error: 'boom' }))).toBe(false);
  });
  it('summarises and is only ok when every plan passes', () => {
    const all = summarizeSmoke([ok(), ok({ kind: 'nutrition_plan' })]);
    expect(all).toMatchObject({ passed: 2, total: 2, ok: true });
    const some = summarizeSmoke([ok(), ok({ source: 'template' })]);
    expect(some).toMatchObject({ passed: 1, total: 2, ok: false });
    expect(some.lines[1]).toContain('FAIL');
    expect(summarizeSmoke([]).ok).toBe(false);
  });
  it('needs an explicit yes to run the paid profile', () => {
    expect(smokeGuard('dev', {})).toBeNull();
    expect(smokeGuard('prod', {})).toContain('CONFIRM_PROD_SMOKE=yes');
    expect(smokeGuard('prod', { CONFIRM_PROD_SMOKE: 'yes' })).toBeNull();
  });
});

describe('getRuntimeModelProfile (paid models in production only)', () => {
  it('allows dev anywhere, and defaults to dev', () => {
    expect(getRuntimeModelProfile('dev', undefined)).toBe(MODEL_PROFILES.dev);
    expect(getRuntimeModelProfile(undefined, 'preview')).toBe(MODEL_PROFILES.dev);
  });
  it('refuses prod unless APP_ENV is production', () => {
    for (const env of [undefined, '', 'staging', 'preview', 'development']) {
      expect(() => getRuntimeModelProfile('prod', env), String(env)).toThrow(/APP_ENV=production/);
    }
    expect(getRuntimeModelProfile('prod', 'production')).toBe(MODEL_PROFILES.prod);
    expect(getRuntimeModelProfile(' prod ', ' production ')).toBe(MODEL_PROFILES.prod);
  });
  it('still rejects unknown profiles', () => {
    expect(() => getRuntimeModelProfile('gold', 'production')).toThrow(/Unknown MODEL_PROFILE/);
  });
});
