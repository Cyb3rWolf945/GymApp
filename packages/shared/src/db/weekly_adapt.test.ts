import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, createDb } from './harness';

const A = '00000000-0000-0000-0000-0000000000d1';
const B = '00000000-0000-0000-0000-0000000000d2';
let db: PGlite;
const state = async (user: string) =>
  (await db.query<{ kind: string; adapt_state: string | null }>(`select kind, adapt_state from public.generation_jobs where user_id = '${user}' order by kind`)).rows;

beforeAll(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}')`);
  await db.exec(`insert into public.generation_jobs(user_id, kind, status, source, adapt_week, adapt_state) values
    ('${A}','workout_plan','done','weekly','2026-11-23','new'), ('${A}','nutrition_plan','done','weekly','2026-11-23','new'),
    ('${A}','workout_plan','done','user',null,null), ('${B}','workout_plan','done','weekly','2026-11-23','new')`);
}, 60_000);
afterAll(() => db.close());

describe('weekly adaptation (E-54)', () => {
  it('weekly updates are on by default', async () => {
    const { rows } = await db.query<{ weekly_adapt: boolean }>(`select weekly_adapt from public.profiles where user_id = '${A}'`);
    expect(rows[0].weekly_adapt).toBe(true);
  });

  it('a user can switch it off on their own profile only', async () => {
    await asUser(db, A, () => db.query(`update public.profiles set weekly_adapt = false where user_id = '${A}'`));
    await asUser(db, A, () => db.query(`update public.profiles set weekly_adapt = false where user_id = '${B}'`));
    const { rows } = await db.query<{ user_id: string; weekly_adapt: boolean }>(`select user_id, weekly_adapt from public.profiles where user_id in ('${A}','${B}')`);
    expect(Object.fromEntries(rows.map((r) => [r.user_id, r.weekly_adapt]))).toEqual({ [A]: false, [B]: true });
  });

  it('is idempotent per user, kind and week; a failed job can be retried', async () => {
    await expect(db.exec(`insert into public.generation_jobs(user_id, kind, status, source, adapt_week) values ('${A}','workout_plan','queued','weekly','2026-11-23')`)).rejects.toThrow();
    await db.exec(`insert into public.generation_jobs(user_id, kind, status, source, adapt_week) values ('${B}','nutrition_plan','failed','weekly','2026-11-23')`);
    await db.exec(`insert into public.generation_jobs(user_id, kind, status, source, adapt_week) values ('${B}','nutrition_plan','queued','weekly','2026-11-23')`);
  });

  it('"Go back to last week" reverts only my own weekly jobs of that week', async () => {
    const n = await asUser(db, A, async () => (await db.query<{ n: number }>(`select public.resolve_weekly_adapt('2026-11-23', false) as n`)).rows[0].n);
    expect(n).toBe(2);
    expect(await state(A)).toEqual([
      { kind: 'nutrition_plan', adapt_state: 'reverted' }, { kind: 'workout_plan', adapt_state: 'reverted' }, { kind: 'workout_plan', adapt_state: null },
    ].sort((x, y) => x.kind.localeCompare(y.kind)));
    expect((await state(B)).find((r) => r.adapt_state)?.adapt_state).toBe('new');
  });

  it('"Keep new plan" marks it kept, and a decided week cannot be changed again', async () => {
    const keep = await asUser(db, B, async () => (await db.query<{ n: number }>(`select public.resolve_weekly_adapt('2026-11-23', true) as n`)).rows[0].n);
    expect(keep).toBe(1);
    const again = await asUser(db, B, async () => (await db.query<{ n: number }>(`select public.resolve_weekly_adapt('2026-11-23', false) as n`)).rows[0].n);
    expect(again).toBe(0);
  });

  it('users cannot call it anonymously', async () => {
    await expect(db.query(`set role anon; select public.resolve_weekly_adapt('2026-11-23', true)`)).rejects.toThrow();
    await db.exec('reset role');
  });
});
