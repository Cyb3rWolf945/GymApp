import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySeed, asUser, createDb } from './harness';

// E-52: correcting and deleting logged sets and workouts from History. The app does these as the signed-in user, so
// the database must let people change their own rows and nobody else's (policies exist from the first RLS migration;
// this proves update and delete work for the owner and affect nothing for anyone else).

const A = '00000000-0000-0000-0000-0000000000b1';
const B = '00000000-0000-0000-0000-0000000000b2';
const SESSION_A = '10000000-0000-4000-8000-0000000000b1';
const SET_A1 = '11000000-0000-4000-8000-0000000000b1';
const SET_A2 = '11000000-0000-4000-8000-0000000000b2';
const SESSION_B = '20000000-0000-4000-8000-0000000000b1';
const SET_B1 = '21000000-0000-4000-8000-0000000000b1';
let db: PGlite;
let exercise: string;

beforeAll(async () => {
  db = await createDb();
  await applySeed(db);
  await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}')`);
  exercise = (await db.query<{ id: string }>(`select id from public.exercises order by slug limit 1`)).rows[0].id;
  await db.exec(`
    insert into public.workout_sessions(id, user_id, started_at, finished_at) values
      ('${SESSION_A}','${A}', now() - interval '2 days', now() - interval '2 days' + interval '1 hour'),
      ('${SESSION_B}','${B}', now() - interval '2 days', now() - interval '2 days' + interval '1 hour')`);
  await db.exec(`
    insert into public.set_logs(id, user_id, session_id, exercise_id, set_index, reps, weight_kg, rpe) values
      ('${SET_A1}','${A}','${SESSION_A}','${exercise}',0,5,1000,null),
      ('${SET_A2}','${A}','${SESSION_A}','${exercise}',1,5,100,8),
      ('${SET_B1}','${B}','${SESSION_B}','${exercise}',0,5,80,null)`);
}, 120_000);
afterAll(() => db.close());

const weightOf = async (id: string) => (await db.query<{ weight_kg: string }>(`select weight_kg from public.set_logs where id = '${id}'`)).rows[0]?.weight_kg;
const count = async (table: string, where: string) => Number((await db.query<{ n: string }>(`select count(*) n from public.${table} where ${where}`)).rows[0].n);

describe('correcting a set (the app sends the whole row again, as an upsert by id)', () => {
  it('the owner can fix their own set', async () => {
    const r = await asUser(db, A, () => db.query(`update public.set_logs set weight_kg = 100, rpe = 8 where id = '${SET_A1}'`));
    expect(r.affectedRows).toBe(1);
    expect(Number(await weightOf(SET_A1))).toBe(100);
  });
  it('an upsert of the same row by id updates it and does not add a second one', async () => {
    await asUser(db, A, () =>
      db.query(
        `insert into public.set_logs(id, user_id, session_id, exercise_id, set_index, reps, weight_kg, rpe)
         values ('${SET_A2}','${A}','${SESSION_A}','${exercise}',1,6,102.5,9)
         on conflict (id) do update set reps = excluded.reps, weight_kg = excluded.weight_kg, rpe = excluded.rpe`,
      ),
    );
    expect(Number(await weightOf(SET_A2))).toBe(102.5);
    expect(await count('set_logs', `session_id = '${SESSION_A}'`)).toBe(2);
  });
  it("nobody can change someone else's set: nothing is updated", async () => {
    const r = await asUser(db, B, () => db.query(`update public.set_logs set weight_kg = 1 where id = '${SET_A1}'`));
    expect(r.affectedRows).toBe(0);
    expect(Number(await weightOf(SET_A1))).toBe(100);
  });
  it("nobody can move a set into someone else's workout, or take it over", async () => {
    await expect(asUser(db, B, () => db.query(`insert into public.set_logs(id, user_id, session_id, exercise_id, set_index, reps, weight_kg) values ('${SET_A1}','${B}','${SESSION_B}','${exercise}',0,1,1) on conflict (id) do update set weight_kg = excluded.weight_kg`))).rejects.toThrow(/row-level security/);
    await expect(asUser(db, A, () => db.query(`update public.set_logs set user_id = '${B}' where id = '${SET_A1}'`))).rejects.toThrow(/row-level security/);
  });
});

describe('deleting', () => {
  it("nobody can delete someone else's set or workout", async () => {
    expect((await asUser(db, B, () => db.query(`delete from public.set_logs where id = '${SET_A2}'`))).affectedRows).toBe(0);
    expect((await asUser(db, B, () => db.query(`delete from public.workout_sessions where id = '${SESSION_A}'`))).affectedRows).toBe(0);
    expect(await count('set_logs', `session_id = '${SESSION_A}'`)).toBe(2);
    expect(await count('workout_sessions', `id = '${SESSION_A}'`)).toBe(1);
  });
  it('the owner can delete a set, and deleting one that is already gone is harmless', async () => {
    expect((await asUser(db, A, () => db.query(`delete from public.set_logs where id = '${SET_A2}'`))).affectedRows).toBe(1);
    expect((await asUser(db, A, () => db.query(`delete from public.set_logs where id = '${SET_A2}'`))).affectedRows).toBe(0);
    expect(await count('set_logs', `session_id = '${SESSION_A}'`)).toBe(1);
  });
  it('the owner can delete a whole workout, and its sets go with it', async () => {
    expect((await asUser(db, A, () => db.query(`delete from public.workout_sessions where id = '${SESSION_A}'`))).affectedRows).toBe(1);
    expect(await count('set_logs', `session_id = '${SESSION_A}'`)).toBe(0);
  });
  it("the other user's data is untouched by all of that", async () => {
    expect(await count('workout_sessions', `id = '${SESSION_B}'`)).toBe(1);
    expect(Number(await weightOf(SET_B1))).toBe(80);
  });
});
