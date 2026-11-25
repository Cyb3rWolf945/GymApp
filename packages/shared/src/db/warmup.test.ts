import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySeed, createDb } from './harness';

const U = '00000000-0000-0000-0000-0000000000f1';
let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
  await db.exec(`insert into auth.users(id) values ('${U}')`);
  const ex = (await db.query<{ id: string }>(`select id from public.exercises order by slug limit 1`)).rows[0].id;
  await db.exec(`insert into public.workout_sessions(id, user_id, started_at, finished_at) values
    ('10000000-0000-4000-8000-0000000000f1','${U}', now() - interval '3 days', now() - interval '3 days' + interval '1 hour'),
    ('10000000-0000-4000-8000-0000000000f2','${U}', now() - interval '1 day', now() - interval '1 day' + interval '1 hour')`);
  // Two workouts: 100 kg x 5 working sets; the second one also has a heavy "warm-up" row that must not count.
  await db.exec(`insert into public.set_logs(user_id, session_id, exercise_id, set_index, reps, weight_kg, is_warmup) values
    ('${U}','10000000-0000-4000-8000-0000000000f1','${ex}',0,5,100,false),
    ('${U}','10000000-0000-4000-8000-0000000000f2','${ex}',0,5,100,false),
    ('${U}','10000000-0000-4000-8000-0000000000f2','${ex}',0,5,300,true)`);
}, 60_000);
afterAll(() => db.close());

describe('warm-up sets (E-56)', () => {
  it('a set is a working set unless flagged', async () => {
    const { rows } = await db.query<{ is_warmup: boolean }>(`select is_warmup from public.set_logs where weight_kg = 100 limit 1`);
    expect(rows[0].is_warmup).toBe(false);
  });
  it('warm-ups never reach the planner history (e1RM trend)', async () => {
    const { rows } = await db.query<{ h: { e1rm: { first: number; last: number }[] } }>(`select public.user_history('${U}'::uuid, 28) as h`);
    // 100 kg x 5 both times: first = last. With the 300 kg warm-up counted, "last" would be 350.
    expect(rows[0].h.e1rm).toHaveLength(1);
    expect(rows[0].h.e1rm[0].last).toBe(rows[0].h.e1rm[0].first);
  });
});
