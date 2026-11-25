import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySeed, createDb } from '../db/harness';
import {
  AiCallError,
  MODEL_PROFILES,
  MACRO_TOLERANCE,
  QA_CRITERIA,
  type ExerciseCandidate,
  type PlanInputs,
  type RecipeCandidate,
  type StructuredCall,
  type WorkoutPlan,
  buildPlanInputs,
  estimateSessionMinutes,
  expandEquipment,
  nutritionTemplate,
  runPipeline,
  validateNutrition,
  validateWorkout,
  verdictPasses,
  workoutTemplate,
  type NutritionPlan,
  type QaVerdict,
} from './index';

const USER = '00000000-0000-0000-0000-000000000002';

const inputs = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  goal: 'recomp',
  level: 'intermediate',
  daysPerWeek: 2,
  sessionMinutes: 60,
  conservative: false,
  equipment: ['dumbbells'],
  contraindications: ['knee'],
  allergens: ['nuts'],
  diet: 'omnivore',
  targets: {
    training: { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 215 },
    rest: { kcal: 1800, proteinG: 150, fatG: 60, carbsG: 165 },
  },
  ...over,
});

const ex = (slug: string, o: Partial<ExerciseCandidate> = {}): ExerciseCandidate => ({
  slug, name: slug, equipment: 'dumbbells', level: 'beginner', muscles: ['pectoralis_major'], contraindications: [], ...o,
});
const library: ExerciseCandidate[] = [
  ex('db-press'),
  ex('db-row', { muscles: ['latissimus_dorsi'] }),
  ex('db-squat', { muscles: ['quadriceps'], contraindications: ['knee'] }),
  ex('barbell-bench', { equipment: 'barbell' }),
  ex('db-snatch', { level: 'advanced' }),
  ex('goblet', { muscles: ['quadriceps'] }),
];
const line = (slug: string, sets = 3) => ({ exerciseSlug: slug, sets, repsMin: 8, repsMax: 12, rpe: 8, restSeconds: 90 });
const goodWorkout: WorkoutPlan = {
  split: 'full_body',
  days: [
    { name: 'A', exercises: [line('db-press'), line('db-row'), line('goblet')] },
    { name: 'B', exercises: [line('db-press'), line('db-row'), line('goblet')] },
  ],
  rationale: 'Two full-body days.',
};

describe('validateWorkout', () => {
  it('accepts a good plan', () => {
    expect(validateWorkout(goodWorkout, inputs(), library)).toEqual([]);
  });
  it('rejects unknown, wrong-equipment, contraindicated and too-advanced exercises', () => {
    const plan = { ...goodWorkout, days: [
      { name: 'A', exercises: [line('nope'), line('barbell-bench'), line('db-squat'), line('db-snatch')] },
      goodWorkout.days[1],
    ] };
    const errs = validateWorkout(plan, inputs(), library).join('\n');
    expect(errs).toMatch(/"nope" is not in the exercise library/);
    expect(errs).toMatch(/"barbell-bench" needs equipment/);
    expect(errs).toMatch(/"db-squat" is contraindicated \(knee\)/);
    expect(errs).toMatch(/"db-snatch" is above the user's level/);
  });
  it('accepts gym tiers as equipment', () => {
    const plan = { ...goodWorkout, days: [{ name: 'A', exercises: [line('barbell-bench'), line('db-row'), line('goblet')] }, goodWorkout.days[1]] };
    expect(validateWorkout(plan, inputs({ equipment: ['full_gym'] }), library)).toEqual([]);
  });
  it('checks days per week and session duration', () => {
    expect(validateWorkout({ ...goodWorkout, days: [goodWorkout.days[0]] }, inputs(), library).join()).toMatch(/1 training days/);
    const long = { name: 'L', exercises: Array.from({ length: 8 }, () => ({ ...line('db-press', 6), restSeconds: 180 })) };
    expect(estimateSessionMinutes(long)).toBeGreaterThan(60);
    expect(validateWorkout({ ...goodWorkout, days: [long, goodWorkout.days[1]] }, inputs(), library).join()).toMatch(/min, over the 60 min/);
  });
  it('flags too many weekly sets for one muscle and too little volume', () => {
    const heavy = { name: 'H', exercises: [line('db-press', 8), line('db-press', 8)] };
    expect(validateWorkout({ ...goodWorkout, days: [heavy, heavy] }, inputs(), library).join()).toMatch(/pectoralis_major gets 32 sets/);
    const light = { name: 'T', exercises: [line('db-press', 1)] };
    expect(validateWorkout({ ...goodWorkout, days: [light, light] }, inputs(), library).join()).toMatch(/Too little volume/);
  });
});

const rec = (slug: string, o: Partial<RecipeCandidate> = {}): RecipeCandidate => ({
  slug, name: slug, diet: 'omnivore', kcal: 600, protein_g: 40, carbs_g: 60, fat_g: 20, allergens: [], ...o,
});
const recipes: RecipeCandidate[] = [rec('a'), rec('nutty', { allergens: ['nuts'] }), rec('meat'), rec('veg', { diet: 'vegan' })];
const day = (dayType: 'training' | 'rest', meals: { recipeSlug: string; portions: number }[]) => ({
  dayType, kcal: 2000, proteinG: 0, carbsG: 0, fatG: 0, meals: meals.map((m, i) => ({ name: `M${i}`, ...m })),
});
// 3 × (600 kcal, 40 p, 60 c, 20 f) × 1.1 = 1980 kcal / 132 p / 198 c / 66 f
const nutrition = (portions: number, slugs = ['a', 'meat', 'veg']): NutritionPlan => ({
  days: [day('training', slugs.map((recipeSlug) => ({ recipeSlug, portions })))],
  rationale: 'x',
});

describe('validateNutrition', () => {
  const t = inputs({ targets: { training: { kcal: 1980, proteinG: 132, carbsG: 198, fatG: 66 }, rest: { kcal: 1800, proteinG: 150, fatG: 60, carbsG: 165 } } });
  it('accepts macros within ±5% (computed from recipes, not model numbers)', () => {
    expect(MACRO_TOLERANCE).toBe(0.05);
    expect(validateNutrition(nutrition(1.1), t, recipes)).toEqual([]);
  });
  it('rejects macros off by more than 5%', () => {
    const errs = validateNutrition(nutrition(1.25), t, recipes).join('\n');
    expect(errs).toMatch(/kcal is 2250, target is 1980/);
  });
  it('rejects allergens, unknown recipes and wrong diet', () => {
    expect(validateNutrition(nutrition(1.1, ['a', 'nutty', 'meat']), t, recipes).join()).toMatch(/"nutty" contains nuts/);
    expect(validateNutrition(nutrition(1.1, ['a', 'zzz']), t, recipes).join()).toMatch(/"zzz" is not in the recipe library/);
    expect(validateNutrition(nutrition(1.1), { ...t, diet: 'vegan' }, recipes).join()).toMatch(/does not fit a vegan diet/);
  });
});

const qa = (over: Partial<QaVerdict['criteria'][number]> = {}, drop = false): QaVerdict => ({
  criteria: QA_CRITERIA.map((c, i) => ({ criterion: c, score: 4, pass: true, feedback: 'ok', ...(i === 0 ? over : {}) })).slice(0, drop ? QA_CRITERIA.length - 1 : QA_CRITERIA.length) as QaVerdict['criteria'],
  pass: true,
  feedback: 'ok',
});

describe('verdictPasses', () => {
  it('needs every criterion to pass with score 3+', () => {
    expect(verdictPasses(qa())).toBe(true);
    expect(verdictPasses(qa({ pass: false }))).toBe(false);
    expect(verdictPasses(qa({ score: 2 }))).toBe(false);
  });
  it('does not trust the model-level pass flag and rejects duplicated criteria', () => {
    const dup = qa();
    dup.criteria[1] = { ...dup.criteria[0] };
    expect(verdictPasses(dup)).toBe(false);
  });
});

describe('model families', () => {
  it('qa primary model is a different family than the planner in both profiles', () => {
    for (const p of [MODEL_PROFILES.dev, MODEL_PROFILES.prod]) {
      const family = (id: string) => id.split('/')[0];
      expect(family(p.roles.qa.primary)).not.toBe(family(p.roles.planner.primary));
    }
  });
});

type Script = (call: StructuredCall<unknown>, n: number) => unknown;
function fakeCall(script: Script) {
  const seen: StructuredCall<unknown>[] = [];
  const call = (async (c: StructuredCall<unknown>) => {
    seen.push(c);
    const out = script(c, seen.length);
    if (out instanceof Error) throw out;
    return out;
  }) as never;
  return { call, seen };
}
const base = { kind: 'workout_plan' as const, userId: USER, jobId: 'job', userText: { notes: '', memory: '' }, library };

describe('runPipeline', () => {
  it('passes on the first try when validator and QA are happy', async () => {
    const { call, seen } = fakeCall((c) => (c.role === 'qa' ? qa() : goodWorkout));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: false });
    expect(r).toMatchObject({ source: 'planner', needsReview: false });
    expect(r.qa).not.toBeNull();
    expect(seen.map((s) => s.role)).toEqual(['planner', 'qa']);
    expect(r.attempts).toHaveLength(1);
  });
  it('feeds validator errors back and succeeds on retry', async () => {
    const bad = { ...goodWorkout, days: [{ name: 'A', exercises: [line('db-squat'), line('db-row'), line('goblet')] }, goodWorkout.days[1]] };
    const { call, seen } = fakeCall((c, n) => (c.role === 'qa' ? qa() : n === 1 ? bad : goodWorkout));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: false });
    expect(r.source).toBe('planner');
    expect(r.attempts.map((a) => a.outcome)).toEqual(['validation_failed', 'passed']);
    expect(seen[1].user).toMatch(/<feedback>.*contraindicated/s);
  });
  it('feeds QA feedback back to the planner', async () => {
    let qaCalls = 0;
    const { call, seen } = fakeCall((c) => (c.role === 'qa' ? (qaCalls++ === 0 ? qa({ pass: false, score: 2, feedback: 'Add a pull exercise.' }) : qa()) : goodWorkout));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: false });
    expect(r.attempts.map((a) => a.outcome)).toEqual(['qa_failed', 'passed']);
    expect(r.attempts[0].qaScores?.safety).toBe(2);
    expect(seen.find((s, i) => i > 1 && s.role === 'planner')?.user).toMatch(/Add a pull exercise/);
  });
  it('stops after 1 + 2 planner attempts, then falls back to the template flagged for review (dev)', async () => {
    const { call, seen } = fakeCall(() => new AiCallError('INVALID_OUTPUT', 'x'));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: false });
    expect(seen).toHaveLength(3);
    expect(seen.some((s) => s.escalate)).toBe(false);
    expect(r).toMatchObject({ source: 'template', needsReview: true, qa: null });
    expect(validateWorkout(r.plan as WorkoutPlan, inputs(), library)).toEqual([]);
  });
  it('tries the escalation model once after the retries (prod)', async () => {
    const { call, seen } = fakeCall((c) => (c.role === 'qa' ? qa() : c.escalate ? goodWorkout : new AiCallError('INVALID_OUTPUT', 'x')));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: true });
    expect(seen.filter((s) => s.role === 'planner').map((s) => !!s.escalate)).toEqual([false, false, false, true]);
    expect(r).toMatchObject({ source: 'escalation', needsReview: false });
  });
  it('uses the template when escalation also fails', async () => {
    const { call, seen } = fakeCall(() => new AiCallError('HTTP_ERROR', 'x'));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: true });
    expect(seen).toHaveLength(4);
    expect(r.source).toBe('template');
  });
  it('keeps a validated plan but flags it when the QA call fails', async () => {
    const { call } = fakeCall((c) => (c.role === 'qa' ? new AiCallError('HTTP_ERROR', 'x') : goodWorkout));
    const r = await runPipeline({ ...base, inputs: inputs(), call, canEscalate: false });
    expect(r).toMatchObject({ source: 'planner', needsReview: true, qa: null });
  });
  it('rethrows unexpected errors', async () => {
    const { call } = fakeCall(() => new TypeError('boom'));
    await expect(runPipeline({ ...base, inputs: inputs(), call, canEscalate: false })).rejects.toThrow('boom');
  });
});

describe('templates and 3 synthetic profiles on the seeded catalog', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb();
    await applySeed(db);
  }, 120_000);
  afterAll(() => db.close());

  const profiles = [
    { sex: 'male', birth_date: '1995-03-01', height_cm: 180, weight_kg: 82, experience: 'intermediate', onboarding: { goalType: 'bulk', daysPerWeek: 4, equipment: ['full_gym'], diet: 'omnivore' } },
    { sex: 'female', birth_date: '2000-07-15', height_cm: 165, weight_kg: 62, experience: 'beginner', onboarding: { goalType: 'cut', cutPace: 'slow', daysPerWeek: 3, equipment: ['dumbbells'], contraindications: ['knee', 'lower_back'], allergens: ['lactose', 'nuts'], diet: 'vegetarian' } },
    { sex: 'male', birth_date: '1988-11-20', height_cm: 175, weight_kg: 90, experience: 'advanced', onboarding: { goalType: 'recomp', daysPerWeek: 5, equipment: ['basic_gym'], allergens: ['shellfish'], diet: 'vegan' } },
  ];

  it.each(profiles.map((p, i) => [i + 1, p] as const))('profile %i: SQL candidates → pipeline → safe result', async (_i, row) => {
    const inp = buildPlanInputs(row, new Date('2026-11-24'));
    const exercises = (await db.query<ExerciseCandidate>(`select * from public.candidate_exercises($1::text[], $2::text[], $3)`, [expandEquipment(inp.equipment), inp.contraindications, inp.level])).rows;
    const foods = (await db.query<RecipeCandidate>(`select * from public.candidate_recipes($1::text[], $2)`, [inp.allergens, inp.diet])).rows;

    // Workout: a fake planner that returns the template passes validator + QA.
    const w = workoutTemplate(inp, exercises);
    expect(validateWorkout(w, inp, exercises)).toEqual([]);
    const okRun = await runPipeline({ kind: 'workout_plan', userId: USER, jobId: 'j', inputs: inp, library: exercises, userText: { notes: '', memory: '' }, canEscalate: false, call: (async (c: StructuredCall<unknown>) => (c.role === 'qa' ? qa() : w)) as never });
    expect(okRun).toMatchObject({ source: 'planner', needsReview: false });

    // Nutrition: a useless model falls back to the template, which is schema-shaped and allergen-free.
    const n = await runPipeline({ kind: 'nutrition_plan', userId: USER, jobId: 'j', inputs: inp, library: foods, userText: { notes: '', memory: '' }, canEscalate: false, call: (async () => { throw new AiCallError('INVALID_OUTPUT', 'x'); }) as never });
    expect(n).toMatchObject({ source: 'template', needsReview: true });
    const plan = n.plan as NutritionPlan;
    const bySlug = new Map(foods.map((f) => [f.slug, f]));
    for (const d of plan.days) for (const m of d.meals) expect(bySlug.get(m.recipeSlug)!.allergens.filter((a) => (inp.allergens as string[]).includes(a))).toEqual([]);
    expect(nutritionTemplate(inp, foods).days.length).toBeGreaterThan(0);
  });
});

// Opt-in: hits the real free OpenRouter models. RUN_LIVE_AI=1 NODE_USE_ENV_PROXY=1 pnpm test
describe.skipIf(!process.env.RUN_LIVE_AI)('live dev models (synthetic data only)', () => {
  it.each([0, 1, 2].map((i) => [i + 1, i] as const))('profile %i produces a valid workout or a flagged template', async (_n, i) => {
    const { callStructured } = await import('./openrouter');
    const row = { sex: 'male', birth_date: '1995-01-01', height_cm: 178, weight_kg: 78, experience: 'beginner', onboarding: { goalType: (['cut', 'bulk', 'recomp'] as const)[i], daysPerWeek: 3, equipment: ['dumbbells'] } };
    const inp = buildPlanInputs(row, new Date('2026-11-24'));
    const r = await runPipeline({
      kind: 'workout_plan', userId: USER, jobId: 'live', inputs: inp, library, userText: { notes: '', memory: '' }, canEscalate: false,
      call: (c) => callStructured({ profile: MODEL_PROFILES.dev, apiKey: process.env.OPENROUTER_API_KEY ?? 'proxy-injected', log: () => {} }, c),
    });
    expect(validateWorkout(r.plan as WorkoutPlan, inp, library)).toEqual([]);
  }, 600_000);
});
