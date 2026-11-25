import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySwaps, expandEquipment, swapSignals, type SwapRow, type WorkoutPlan } from '../index';
import { applySeed, createDb } from '../db/harness';

const line = (slug: string) => ({ exerciseSlug: slug, sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSeconds: 90 });
const plan: WorkoutPlan = { split: 'full_body', rationale: 'x', days: [
  { name: 'A', exercises: [line('lunge'), line('row')] },
  { name: 'B', exercises: [line('lunge'), line('press')] },
] };
const swap = (day_index: number, from_slug: string, to_slug: string, created_at = '2026-11-25T00:00:00Z'): SwapRow => ({ day_index, from_slug, to_slug, created_at });

describe('applySwaps', () => {
  it('replaces the exercise in that day only, keeping sets and reps', () => {
    const out = applySwaps(plan, [swap(0, 'lunge', 'split-squat')]);
    expect(out.days[0].exercises.map((e) => e.exerciseSlug)).toEqual(['split-squat', 'row']);
    expect(out.days[1].exercises.map((e) => e.exerciseSlug)).toEqual(['lunge', 'press']);
    expect(out.days[0].exercises[0]).toMatchObject({ sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 });
  });
  it('does not change the original plan', () => {
    applySwaps(plan, [swap(0, 'lunge', 'x')]);
    expect(plan.days[0].exercises[0].exerciseSlug).toBe('lunge');
  });
  it('applies chains oldest first and ignores stale or out-of-range swaps', () => {
    const out = applySwaps(plan, [
      swap(0, 'step-up', 'goblet', '2026-11-25T00:02:00Z'),
      swap(0, 'lunge', 'step-up', '2026-11-25T00:01:00Z'),
      swap(0, 'nope', 'zzz'),
      swap(9, 'lunge', 'zzz'),
    ]);
    expect(out.days[0].exercises[0].exerciseSlug).toBe('goblet');
    expect(out.days[1].exercises[0].exerciseSlug).toBe('lunge');
  });
});

describe('swapSignals', () => {
  it('reports exercises swapped out repeatedly', () => {
    const rows = [{ from_slug: 'lunge' }, { from_slug: 'lunge' }, { from_slug: 'row' }, { from_slug: 'dip' }, { from_slug: 'dip' }, { from_slug: 'dip' }];
    expect(swapSignals(rows)).toEqual(['dip', 'lunge']);
    expect(swapSignals(rows, 3)).toEqual(['dip']);
    expect(swapSignals([])).toEqual([]);
  });
});

describe('swap_candidates (SQL, deterministic, no LLM)', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDb();
    await applySeed(db);
  }, 120_000);
  afterAll(() => db.close());

  const candidates = (slug: string, equipment: string[], contra: string[] = [], level = 'advanced', exclude: string[] = []) =>
    db.query<{ slug: string; equipment: string; level: string }>(
      `select * from public.swap_candidates($1, $2::text[], $3::text[], $4, $5::text[])`,
      [slug, expandEquipment(equipment), contra, level, exclude],
    ).then((r) => r.rows);

  const pick = async () => {
    // An exercise with a primary muscle shared by several others.
    const r = await db.query<{ slug: string }>(
      `select e.slug from public.exercises e join public.exercise_muscles m on m.exercise_id = e.id and m.role = 'primary'
       where m.muscle = 'quadriceps' and e.equipment = 'barbell' order by e.slug limit 1`);
    return r.rows[0].slug;
  };

  it('returns same-primary-muscle alternatives, never the exercise itself, at most 8', async () => {
    const slug = await pick();
    const rows = await candidates(slug, ['full_gym']);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(rows.map((r) => r.slug)).not.toContain(slug);
    const shared = await db.query<{ n: string }>(
      `select count(*)::text as n from public.exercises e join public.exercise_muscles m on m.exercise_id = e.id and m.role='primary'
       where e.slug = any ($1::text[]) and m.muscle = 'quadriceps'`, [rows.map((r) => r.slug)]);
    expect(Number(shared.rows[0].n)).toBe(rows.length);
  });
  it('respects the equipment the user has', async () => {
    const slug = await pick();
    const rows = await candidates(slug, ['dumbbells']);
    expect(rows.every((r) => ['dumbbells', 'bodyweight'].includes(r.equipment))).toBe(true);
  });
  it('never returns an exercise contraindicated for a declared injury', async () => {
    const slug = await pick();
    const rows = await candidates(slug, ['full_gym'], ['knee', 'lower_back', 'hip']);
    const bad = await db.query(
      `select slug from public.exercises where slug = any ($1::text[]) and contraindications && array['knee','lower_back','hip']::text[]`, [rows.map((r) => r.slug)]);
    expect(bad.rows).toEqual([]);
  });
  it('respects level and the exclude list', async () => {
    const slug = await pick();
    const all = await candidates(slug, ['full_gym']);
    expect(all.length).toBeGreaterThan(1);
    const excluded = await candidates(slug, ['full_gym'], [], 'advanced', [all[0].slug]);
    expect(excluded.map((r) => r.slug)).not.toContain(all[0].slug);
    const beginner = await candidates(slug, ['full_gym'], [], 'beginner');
    expect(beginner.every((r) => r.level === 'beginner')).toBe(true);
  });
  it('is deterministic', async () => {
    const slug = await pick();
    expect(await candidates(slug, ['full_gym'])).toEqual(await candidates(slug, ['full_gym']));
  });
  it('returns nothing for an unknown exercise', async () => {
    expect(await candidates('does-not-exist', ['full_gym'])).toEqual([]);
  });
  it('plan_swaps is own-rows-only under RLS', async () => {
    const { rows } = await db.query<{ rowsecurity: boolean }>(`select relrowsecurity as rowsecurity from pg_class where relname = 'plan_swaps'`);
    expect(rows[0].rowsecurity).toBe(true);
  });
});
