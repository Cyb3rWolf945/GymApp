import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatUserHistory, UserHistorySchema } from '../ai/history';
import { applySeed, createDb } from './harness';

const U = '00000000-0000-0000-0000-0000000000a1';
const OTHER = '00000000-0000-0000-0000-0000000000a2';
let db: PGlite;
let squat: string;
let press: string;

beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
  await db.exec(`insert into auth.users(id) values ('${U}'), ('${OTHER}')`);
  await db.exec(`insert into public.profiles(user_id, onboarding) values ('${U}', '{"daysPerWeek":3}'), ('${OTHER}', '{"daysPerWeek":5}')
    on conflict (user_id) do update set onboarding = excluded.onboarding`);
  const ex = await db.query<{ id: string; slug: string }>(`select id, slug from public.exercises order by slug limit 2`);
  [squat, press] = ex.rows.map((r) => r.id);
  const slugs = ex.rows.map((r) => r.slug);
  // 3 finished workouts in the window, 1 old one, 1 unfinished.
  await db.exec(`
    insert into public.workout_sessions(id, user_id, started_at, finished_at) values
      ('10000000-0000-4000-8000-000000000001','${U}', now() - interval '20 days', now() - interval '20 days' + interval '1 hour'),
      ('10000000-0000-4000-8000-000000000002','${U}', now() - interval '10 days', now() - interval '10 days' + interval '1 hour'),
      ('10000000-0000-4000-8000-000000000003','${U}', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
      ('10000000-0000-4000-8000-000000000004','${U}', now() - interval '60 days', now() - interval '60 days' + interval '1 hour'),
      ('10000000-0000-4000-8000-000000000005','${U}', now() - interval '1 day', null),
      ('20000000-0000-4000-8000-000000000001','${OTHER}', now() - interval '1 day', now())`);
  await db.exec(`
    insert into public.set_logs(user_id, session_id, exercise_id, set_index, reps, weight_kg, logged_at) values
      ('${U}','10000000-0000-4000-8000-000000000001','${squat}',0,5,100, now() - interval '20 days'),
      ('${U}','10000000-0000-4000-8000-000000000001','${squat}',1,8,60,  now() - interval '20 days'),
      ('${U}','10000000-0000-4000-8000-000000000003','${squat}',0,5,110, now() - interval '2 days'),
      ('${U}','10000000-0000-4000-8000-000000000003','${press}',0,10,50, now() - interval '2 days'),
      ('${U}','10000000-0000-4000-8000-000000000004','${press}',0,10,20, now() - interval '60 days'),
      ('${OTHER}','20000000-0000-4000-8000-000000000001','${squat}',0,5,200, now() - interval '1 day')`);
  await db.exec(`
    insert into public.body_metrics(user_id, measured_on, weight_kg) values
      ('${U}', current_date - 25, 82.4), ('${U}', current_date - 1, 82.0), ('${U}', current_date - 90, 99)`);
  await db.exec(`insert into public.generation_jobs(id, user_id, kind) values ('30000000-0000-4000-8000-000000000001','${U}','workout_plan')`);
  await db.exec(`insert into public.plan_swaps(user_id, job_id, day_index, from_slug, to_slug) values
    ('${U}','30000000-0000-4000-8000-000000000001',0,'${slugs[0]}','${slugs[1]}'), ('${U}','30000000-0000-4000-8000-000000000001',1,'${slugs[0]}','${slugs[1]}')`);
  await db.exec(`insert into public.memory_facts(user_id, kind, fact, obsolete) values
    ('${U}','workout_feedback','Prefers dumbbells', false), ('${U}','workout_feedback','Old fact', true), ('${OTHER}','workout_feedback','Someone else', false)`);
}, 120_000);
afterAll(() => db.close());

const history = async (user = U, days = 28) =>
  UserHistorySchema.parse((await db.query<{ h: unknown }>(`select public.user_history($1, $2) as h`, [user, days])).rows[0].h);

describe('public.user_history', () => {
  it('counts adherence against the planned days per week', async () => {
    const h = await history();
    expect(h.workouts_done).toBe(3); // finished, in the last 28 days; not the 60-day-old or unfinished ones
    expect(h.workouts_planned).toBe(12); // 3 per week × 4 weeks
  });
  it('gives the weight trend inside the window only', async () => {
    const h = await history();
    expect(h.weight_first_kg).toBe(82.4);
    expect(h.weight_last_kg).toBe(82);
  });
  it('gives e1RM trends for exercises with at least two workouts in the window', async () => {
    const h = await history();
    expect(h.e1rm).toHaveLength(1); // the second exercise only has one workout in the window
    const e = h.e1rm[0];
    expect(e.first).toBeCloseTo(116.7, 1); // 100 × (1 + 5/30), best set of that workout
    expect(e.last).toBeCloseTo(128.3, 1); // 110 × (1 + 5/30)
  });
  it('lists swapped exercises by catalog name and the active facts only', async () => {
    const h = await history();
    expect(h.swapped_exercises).toHaveLength(1);
    expect(h.swapped_exercises[0].times).toBe(2);
    expect(h.facts).toEqual(['Prefers dumbbells']);
  });
  it('only sees the user\'s own rows and respects the window', async () => {
    const other = await history(OTHER);
    expect(other.workouts_done).toBe(1);
    expect(other.facts).toEqual(['Someone else']);
    const short = await history(U, 7);
    expect(short.workouts_done).toBe(1);
    expect(short.workouts_planned).toBe(3);
  });
  it('is empty and harmless for an unknown user', async () => {
    const h = await history('00000000-0000-0000-0000-0000000000ff');
    expect(h).toMatchObject({ workouts_done: 0, workouts_planned: 0, e1rm: [], facts: [] });
    expect(formatUserHistory(h)).toBe('');
  });
  it('formats into the compact block', async () => {
    const t = formatUserHistory(await history());
    expect(t).toContain('3 of 12 planned workouts (25%)');
    expect(t).toContain('Weight: 82.4 kg → 82 kg');
    expect(t).toContain('- Prefers dumbbells');
    expect(t).not.toContain('Old fact');
  });
  it('is not executable by anon', async () => {
    const r = await db.query<{ ok: boolean }>(`select has_function_privilege('anon', 'public.user_history(uuid,int)', 'execute') as ok`);
    expect(r.rows[0].ok).toBe(false);
  });
});
