import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySeed, createDb } from './harness';

let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, D] = [id(1), id(2), id(3), id(4)];

beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
  await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}'), ('${C}'), ('${D}')`);
  // Profiles are created by the signup trigger; set signup dates and the days per week they asked for.
  await db.exec(`
    update public.profiles set created_at = now() - interval '40 days', onboarding = '{"daysPerWeek":3}' where user_id = '${A}';
    update public.profiles set created_at = now() - interval '40 days', onboarding = '{"daysPerWeek":2}' where user_id = '${B}';
    update public.profiles set created_at = now() - interval '3 days',  onboarding = '{"daysPerWeek":3}' where user_id = '${C}';
    update public.profiles set created_at = now() - interval '40 days', onboarding = '{}' where user_id = '${D}'`);
  // A: workouts 1, 2 and 30 days after signup (day 40 ago = signup). B: only day 7 after signup.
  const s = (n: number, user: string, daysAgo: number, finished = true) =>
    db.exec(`insert into public.workout_sessions(id, user_id, started_at, finished_at) values ('${id(100 + n)}', '${user}', now() - interval '${daysAgo} days', ${finished ? `now() - interval '${daysAgo} days' + interval '1 hour'` : 'null'})`);
  await s(1, A, 39); await s(2, A, 33); await s(3, A, 10); await s(4, A, 2); await s(5, A, 1, false);
  await s(6, B, 33); await s(7, B, 1);
  // The signup trigger logs a 'signup' event per user today; remove them so the scenario is exact.
  await db.exec(`delete from public.analytics_events`);
  await db.exec(`insert into public.analytics_events(user_id, name) values ('${C}', 'app_open'), (null, 'visit')`);
}, 120_000);
afterAll(() => db.close());

const q = async <T>(sql: string) => (await db.query<T>(sql)).rows;

describe('engagement_daily', () => {
  it('returns one row per day, today last', async () => {
    const r = await q<{ day: string }>(`select day::text from public.engagement_daily(7)`);
    expect(r).toHaveLength(7);
    const today = (await q<{ d: string }>(`select current_date::text as d`))[0].d;
    expect(r[6].day).toBe(today);
  });
  it('counts DAU, WAU and finished workouts', async () => {
    const r = await q<{ day: string; dau: number; wau: number; workouts: number }>(`select day::text, dau, wau, workouts from public.engagement_daily(3) order by day`);
    // 2 days ago: A finished a workout; yesterday: A's unfinished one and B's finished one; today: C's app_open event.
    expect(r.map((x) => x.dau)).toEqual([1, 2, 1]);
    expect(r.map((x) => x.workouts)).toEqual([1, 1, 0]);
    expect(r[2].wau).toBe(3); // A, B, C all active within the last 7 days
  });
  it('ignores anonymous events', async () => {
    const r = await q<{ dau: number }>(`select dau from public.engagement_daily(1)`);
    expect(r[0].dau).toBe(1); // only C; the anonymous 'visit' is not a user
  });
});

describe('engagement_adherence', () => {
  it('compares finished workouts with the planned days per week, capped at 100%', async () => {
    const r = (await q<{ users: number; avg_pct: string }>(`select users, avg_pct::text from public.engagement_adherence(28)`))[0];
    // A: finished workouts in the last 28 days = 2 (10 and 2 days ago), planned 3/wk × 4 = 12 → 16.7%.
    // B: 1 finished (1 day ago), planned 2/wk × 4 = 8 → 12.5%. C is under a week old; D never set days per week.
    expect(r.users).toBe(2);
    expect(Number(r.avg_pct)).toBeCloseTo(14.6, 1);
  });
});

describe('retention_cohorts', () => {
  it('counts who came back 1, 7 and 30 days after signup, and leaves unreached days null', async () => {
    const rows = await q<{ cohort: string; size: number; d1: number | null; d7: number | null; d30: number | null }>(
      `select cohort::text, size, d1, d7, d30 from public.retention_cohorts(60) order by cohort`);
    expect(rows).toHaveLength(2);
    const old = rows[0]; // signed up 40 days ago: A, B, D
    expect(old.size).toBe(3);
    expect(old.d1).toBe(1); // A at day +1 (39 days ago)
    expect(old.d7).toBe(2); // A at +7 (33 days ago) and B at +7
    expect(old.d30).toBe(1); // A at +30 (10 days ago)
  });
  it('leaves columns null until the day is reached', async () => {
    const recent = (await q<{ size: number; d1: number | null; d7: number | null; d30: number | null }>(
      `select size, d1, d7, d30 from public.retention_cohorts(60) order by cohort desc limit 1`))[0];
    expect(recent.size).toBe(1);
    expect(recent.d7).toBeNull();
    expect(recent.d30).toBeNull();
  });
});

describe('top_swaps', () => {
  it('names the most swapped exercises and meals, without user ids', async () => {
    const ex = await q<{ slug: string }>(`select slug from public.exercises order by slug limit 2`);
    const rc = await q<{ slug: string }>(`select slug from public.recipes order by slug limit 2`);
    await db.exec(`insert into public.generation_jobs(id, user_id, kind) values ('${id(200)}', '${A}', 'workout_plan'), ('${id(201)}', '${A}', 'nutrition_plan')`);
    await db.exec(`insert into public.plan_swaps(user_id, job_id, day_index, from_slug, to_slug) values
      ('${A}', '${id(200)}', 0, '${ex[0].slug}', '${ex[1].slug}'), ('${B}', '${id(200)}', 0, '${ex[0].slug}', '${ex[1].slug}')`);
    await db.exec(`insert into public.meal_swaps(user_id, job_id, day_index, meal_index, from_slug, to_slug) values ('${A}', '${id(201)}', 0, 0, '${rc[0].slug}', '${rc[1].slug}')`);
    const rows = await q<{ kind: string; name: string; swaps: number }>(`select * from public.top_swaps(5)`);
    expect(rows.filter((r) => r.kind === 'exercise')).toEqual([expect.objectContaining({ swaps: 2 })]);
    expect(rows.filter((r) => r.kind === 'meal')).toEqual([expect.objectContaining({ swaps: 1 })]);
    expect(Object.keys(rows[0]).sort()).toEqual(['kind', 'name', 'swaps']);
  });
});

describe('prompt versions', () => {
  it('keeps one active version per name and switches atomically', async () => {
    await db.exec(`insert into public.prompt_versions(id, name, version, body, active) values
      ('${id(300)}', 'planner', 1, 'v1', true), ('${id(301)}', 'planner', 2, 'v2', false), ('${id(302)}', 'qa', 1, 'q1', true)`);
    await expect(db.exec(`update public.prompt_versions set active = true where id = '${id(301)}'`)).rejects.toThrow(/unique|duplicate/);
    const ok = (await q<{ ok: boolean }>(`select public.activate_prompt_version('${id(301)}') as ok`))[0].ok;
    expect(ok).toBe(true);
    const rows = await q<{ name: string; version: number; active: boolean }>(`select name, version, active from public.prompt_versions order by name, version`);
    expect(rows).toEqual([
      { name: 'planner', version: 1, active: false }, { name: 'planner', version: 2, active: true }, { name: 'qa', version: 1, active: true },
    ]);
    expect((await q<{ ok: boolean }>(`select public.activate_prompt_version('${id(999)}') as ok`))[0].ok).toBe(false);
  });
});

describe('eval_runs and privileges', () => {
  it('checks totals and suites', async () => {
    await expect(db.exec(`insert into public.eval_runs(suite, profile, total, passed) values ('red_team', 'offline', 5, 6)`)).rejects.toThrow();
    await expect(db.exec(`insert into public.eval_runs(suite, profile, total, passed) values ('nope', 'offline', 5, 5)`)).rejects.toThrow();
    await expect(db.exec(`insert into public.eval_runs(suite, profile, total, passed) values ('red_team', 'offline', 5, 5)`)).resolves.toBeDefined();
  });
  it('functions are for the service role only', async () => {
    for (const fn of ['engagement_daily(int)', 'engagement_adherence(int)', 'retention_cohorts(int)', 'top_swaps(int)', 'activate_prompt_version(uuid)']) {
      for (const [role, want] of [['service_role', true], ['anon', false], ['authenticated', false]] as const) {
        const r = await q<{ ok: boolean }>(`select has_function_privilege('${role}', 'public.${fn}', 'execute') as ok`);
        expect(r[0].ok, `${role} ${fn}`).toBe(want);
      }
    }
  });
});
