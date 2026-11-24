import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateTypes } from './gen-types';
import { asUser, createDb } from './harness';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}');
    insert into public.profiles(user_id) values ('${A}'), ('${B}');
    insert into public.entitlements(user_id, tier, status) values ('${A}','pro','active'), ('${B}','basic','active');
    insert into public.body_metrics(user_id, weight_kg) values ('${A}', 80), ('${B}', 70);
    insert into public.generation_jobs(user_id, kind) values ('${A}','workout_plan');
    insert into public.exercises(slug, name) values ('squat','Squat');
    insert into public.prompt_versions(name, version, body) values ('planner',1,'x');
    insert into public.admins(user_id) values ('${A}');`);
}, 60_000);
afterAll(() => db.close());

const userTables = ['workout_plans','workout_days','planned_exercises','workout_sessions','set_logs',
  'nutrition_plans','meals','shopping_list_items','body_metrics','profiles','entitlements','generation_jobs','memory_facts'];
const adminTables = ['ai_call_logs','guardrail_events','analytics_events','admins','admin_audit_log',
  'prompt_versions','ad_creatives','ad_insights_daily','cost_entries','revenue_daily'];
const catalog = ['exercises','exercise_muscles','recipes','ingredients','recipe_ingredients'];

describe('RLS', () => {
  it('is enabled on every public table', async () => {
    const r = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(r.rows).toEqual([]);
  });

  it("user cannot read another user's rows", async () => {
    for (const t of ['profiles', 'entitlements', 'body_metrics', 'generation_jobs']) {
      const rows = await asUser(db, B, async () => (await db.query<{ user_id: string }>(`select user_id from public.${t}`)).rows);
      expect(rows.every((r) => r.user_id === B), t).toBe(true);
    }
    const own = await asUser(db, A, async () => (await db.query(`select * from public.body_metrics`)).rows);
    expect(own).toHaveLength(1);
  });

  it("user cannot write another user's rows", async () => {
    await expect(
      asUser(db, B, () => db.query(`insert into public.body_metrics(user_id, weight_kg) values ('${A}', 1)`)),
    ).rejects.toThrow(/row-level security/);
    const upd = await asUser(db, B, () => db.query(`update public.body_metrics set weight_kg = 1 where user_id = '${A}'`));
    expect(upd.affectedRows).toBe(0);
  });

  it('entitlements are read-only for users', async () => {
    await expect(
      asUser(db, A, () => db.query(`update public.entitlements set tier='elite' where user_id='${A}'`)),
    ).resolves.toMatchObject({ affectedRows: 0 });
    await expect(
      asUser(db, B, () => db.query(`insert into public.entitlements(user_id, tier) values ('${B}','elite') on conflict do nothing`)),
    ).rejects.toThrow();
  });

  it('catalog is readable but not writable by authenticated', async () => {
    const rows = await asUser(db, A, async () => (await db.query(`select * from public.exercises`)).rows);
    expect(rows).toHaveLength(1);
    await expect(asUser(db, A, () => db.query(`insert into public.exercises(slug,name) values ('x','x')`))).rejects.toThrow(/row-level security/);
  });

  it('admin tables are invisible to authenticated users', async () => {
    for (const t of adminTables) {
      const rows = await asUser(db, A, async () => (await db.query(`select * from public.${t}`)).rows);
      expect(rows, t).toEqual([]);
    }
    const sr = await db.query(`select * from public.admins`); // superuser sanity check
    expect(sr.rows).toHaveLength(1);
  });

  it('table groups cover the schema', async () => {
    const r = await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname='public'`);
    const known = new Set([...userTables, ...adminTables, ...catalog]);
    expect(r.rows.map((x) => x.tablename).filter((t) => !known.has(t))).toEqual([]);
  });
});

describe('generated types', () => {
  it('database.types.ts is up to date (run `pnpm gen:types`)', async () => {
    const file = readFileSync(join(__dirname, 'database.types.ts'), 'utf8');
    expect(file).toBe(await generateTypes(db));
  });
});
