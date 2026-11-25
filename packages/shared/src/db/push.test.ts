import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './harness';

const U = '00000000-0000-0000-0000-0000000000b1';
const V = '00000000-0000-0000-0000-0000000000b2';
const W = '00000000-0000-0000-0000-0000000000b3';
let db: PGlite;

const tok = (n: string) => `ExponentPushToken[${n.padEnd(12, 'x')}]`;
const addToken = (user: string, n: string, tz = 'UTC', hour = 17, extra = '') =>
  db.exec(`insert into public.push_tokens(user_id, token, platform, tz, remind_hour${extra ? ', ' + extra.split('=')[0] : ''}) values ('${user}', '${tok(n)}', 'ios', '${tz}', ${hour}${extra ? ', ' + extra.split('=')[1] : ''})`);
const due = async (now: string) =>
  (await db.query<{ token: string; local_date: string; iso_weekday: number; display_name: string | null }>(`select token, local_date::text, iso_weekday, display_name from public.reminder_candidates('${now}') order by token`)).rows;

beforeAll(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users(id) values ('${U}'), ('${V}'), ('${W}')`);
  await db.exec(`update public.profiles set display_name = 'Ana' where user_id = '${U}'`);
}, 60_000);
afterAll(() => db.close());

describe('push_tokens', () => {
  it('accepts Expo tokens only', async () => {
    await expect(addToken(U, 'valid1')).resolves.toBeDefined();
    await expect(db.exec(`insert into public.push_tokens(user_id, token, platform) values ('${U}', 'not-a-token', 'ios')`)).rejects.toThrow();
    await expect(db.exec(`insert into public.push_tokens(user_id, token, platform) values ('${U}', 'ExponentPushToken[x]', 'ios')`)).rejects.toThrow();
    await expect(db.exec(`insert into public.push_tokens(user_id, token, platform) values ('${U}', '${tok('valid1')}', 'ios')`)).rejects.toThrow(/unique|duplicate/);
  });
  it('only known platforms, hours and IANA time zones', async () => {
    await expect(db.exec(`insert into public.push_tokens(user_id, token, platform) values ('${U}', '${tok('plat')}', 'web')`)).rejects.toThrow();
    await expect(addToken(U, 'hour', 'UTC', 24)).rejects.toThrow();
    await expect(addToken(U, 'tzbad', 'Mars/Olympus')).rejects.toThrow(/time zone/i);
    await expect(addToken(U, 'tzdrop', `UTC'; drop table x;--`)).rejects.toThrow();
  });
  it('is own-rows-only under RLS and cascades on user delete', async () => {
    const rls = await db.query<{ on: boolean }>(`select relrowsecurity as on from pg_class where relname = 'push_tokens'`);
    expect(rls.rows[0].on).toBe(true);
    await db.exec(`insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000b9')`);
    await addToken('00000000-0000-0000-0000-0000000000b9', 'cascade');
    await db.exec(`delete from auth.users where id = '00000000-0000-0000-0000-0000000000b9'`);
    const left = await db.query(`select 1 from public.push_tokens where user_id = '00000000-0000-0000-0000-0000000000b9'`);
    expect(left.rows).toEqual([]);
  });
});

describe('reminder_candidates', () => {
  it('finds enabled tokens in their local reminder hour', async () => {
    const rows = await due('2026-11-25T17:30:00Z');
    expect(rows.map((r) => r.token)).toEqual([tok('valid1')]);
    expect(rows[0]).toMatchObject({ local_date: '2026-11-25', iso_weekday: 3, display_name: 'Ana' }); // 2026-11-25 is a Wednesday
  });
  it('only fires in the token\'s local hour, in its own time zone', async () => {
    expect(await due('2026-11-25T16:59:00Z')).toEqual([]);
    expect(await due('2026-11-25T18:00:00Z')).toEqual([]);
    await addToken(V, 'lisbon', 'Asia/Tokyo', 17); // 17:00 in Tokyo is 08:00 UTC
    const rows = await due('2026-11-25T08:10:00Z');
    expect(rows.map((r) => r.token)).toEqual([tok('lisbon')]);
    expect(rows[0].local_date).toBe('2026-11-25');
  });
  it('local date and weekday follow the time zone (not UTC)', async () => {
    // 2026-11-25T20:00Z is already Thursday 05:00 in Tokyo; set the token's hour to 5.
    await db.exec(`update public.push_tokens set remind_hour = 5 where token = '${tok('lisbon')}'`);
    const rows = await due('2026-11-25T20:30:00Z');
    expect(rows).toEqual([expect.objectContaining({ token: tok('lisbon'), local_date: '2026-11-26', iso_weekday: 4 })]);
  });
  it('sends at most once per local day and skips disabled tokens', async () => {
    await db.exec(`update public.push_tokens set last_sent_on = '2026-11-25' where token = '${tok('valid1')}'`);
    expect(await due('2026-11-25T17:30:00Z')).toEqual([]);
    expect(await due('2026-11-26T17:30:00Z')).toHaveLength(1); // next day it is due again
    await db.exec(`update public.push_tokens set enabled = false where token = '${tok('valid1')}'`);
    expect(await due('2026-11-26T17:30:00Z')).toEqual([]);
  });
  it('is callable by the service role only', async () => {
    const priv = async (role: string) =>
      (await db.query<{ ok: boolean }>(`select has_function_privilege('${role}', 'public.reminder_candidates(timestamptz)', 'execute') as ok`)).rows[0].ok;
    expect(await priv('service_role')).toBe(true);
    expect(await priv('anon')).toBe(false);
    expect(await priv('authenticated')).toBe(false);
  });
});
