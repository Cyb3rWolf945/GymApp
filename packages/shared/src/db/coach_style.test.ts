import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, createDb } from './harness';

const A = '00000000-0000-0000-0000-0000000000e1';
const B = '00000000-0000-0000-0000-0000000000e2';
let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}')`);
}, 60_000);
afterAll(() => db.close());

const styleOf = async (u: string) => (await db.query<{ coach_style: string }>(`select coach_style from public.profiles where user_id = '${u}'`)).rows[0].coach_style;

describe('profiles.coach_style (E-55)', () => {
  it('is Calm by default', async () => {
    expect(await styleOf(A)).toBe('calm');
  });
  it('accepts calm, direct and hype, and nothing else', async () => {
    for (const s of ['direct', 'hype', 'calm']) {
      await db.exec(`update public.profiles set coach_style = '${s}' where user_id = '${A}'`);
      expect(await styleOf(A)).toBe(s);
    }
    await expect(db.exec(`update public.profiles set coach_style = 'angry' where user_id = '${A}'`)).rejects.toThrow();
    await expect(db.exec(`update public.profiles set coach_style = null where user_id = '${A}'`)).rejects.toThrow();
  });
  it('a user changes their own style only (RLS unchanged)', async () => {
    await asUser(db, A, () => db.query(`update public.profiles set coach_style = 'hype' where user_id = '${A}'`));
    await asUser(db, A, () => db.query(`update public.profiles set coach_style = 'direct' where user_id = '${B}'`));
    expect(await styleOf(A)).toBe('hype');
    expect(await styleOf(B)).toBe('calm');
  });
});
