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
    insert into public.profiles(user_id) values ('${A}'), ('${B}') on conflict do nothing;
    insert into public.entitlements(user_id, tier, status) values ('${A}','pro','active'), ('${B}','basic','active');
    insert into public.body_metrics(user_id, weight_kg) values ('${A}', 80), ('${B}', 70);
    insert into public.generation_jobs(user_id, kind) values ('${A}','workout_plan');
    insert into public.exercises(slug, name) values ('squat','Squat');
    insert into public.prompt_versions(name, version, body) values ('planner',1,'x');
    insert into public.admins(user_id) values ('${A}');`);
}, 60_000);
afterAll(() => db.close());

const userTables = ['workout_plans','workout_days','planned_exercises','workout_sessions','set_logs',
  'nutrition_plans','meals','shopping_list_items','body_metrics','profiles','entitlements','generation_jobs','memory_facts','plan_swaps','meal_swaps'];
const adminTables = ['ai_call_logs','guardrail_events','analytics_events','admins','admin_audit_log',
  'prompt_versions','ad_creatives','ad_insights_daily','cost_entries','revenue_daily','stripe_events'];
const catalog = ['exercises','exercise_muscles','recipes','ingredients','recipe_ingredients','plan_prices'];

describe('auth profile trigger', () => {
  it('creates a profile on first sign-in, using the provider name', async () => {
    const id = '00000000-0000-0000-0000-0000000000c1';
    await db.exec(`insert into auth.users(id, email, raw_user_meta_data) values ('${id}', 'c@x.co', '{"full_name":"Cy"}')`);
    const r = await db.query<{ display_name: string }>(`select display_name from public.profiles where user_id='${id}'`);
    expect(r.rows).toEqual([{ display_name: 'Cy' }]);
  });
});

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

describe('has_access (E-17)', () => {
  const U = '00000000-0000-0000-0000-0000000000f1';
  const set = async (tier: string, status: string, end: string, since = 'null') => {
    await db.exec(`insert into auth.users(id) values ('${U}') on conflict do nothing;
      insert into public.profiles(user_id) values ('${U}') on conflict do nothing;
      insert into public.entitlements(user_id, tier, status, current_period_end, past_due_since)
        values ('${U}', '${tier}', '${status}', ${end}, ${since})
        on conflict (user_id) do update set tier = excluded.tier, status = excluded.status,
          current_period_end = excluded.current_period_end, past_due_since = excluded.past_due_since`);
  };
  const access = async (feature = 'basic') => (await db.query<{ ok: boolean }>(`select public.has_access('${U}', '${feature}') as ok`)).rows[0].ok;

  it('follows the access rules', async () => {
    const future = "now() + interval '10 days'";
    await set('pro', 'active', future);
    expect(await access()).toBe(true);
    await set('pro', 'trialing', future);
    expect(await access('nutrition')).toBe(true);
    await set('basic', 'active', future);
    expect(await access()).toBe(true);
    expect(await access('nutrition')).toBe(false);
    await set('pro', 'active', "now() - interval '1 day'");
    expect(await access()).toBe(false);
    await set('pro', 'canceled', future);
    expect(await access()).toBe(false);
    await set('none', 'active', future);
    expect(await access()).toBe(false);
  });
  it('keeps past_due users for 7 days from the first failure', async () => {
    const future = "now() + interval '10 days'";
    await set('pro', 'past_due', future, "now() - interval '3 days'");
    expect(await access()).toBe(true);
    await set('pro', 'past_due', future, "now() - interval '8 days'");
    expect(await access()).toBe(false);
    await set('pro', 'past_due', future);
    expect(await access()).toBe(false);
  });
  it('returns false for unknown users', async () => {
    expect((await db.query<{ ok: boolean }>(`select public.has_access('00000000-0000-0000-0000-0000000000ee') as ok`)).rows[0].ok).toBe(false);
  });
  it('my_access answers only for the caller', async () => {
    await set('pro', 'active', "now() + interval '10 days'");
    await asUser(db, U, async () => {
      expect((await db.query<{ ok: boolean }>(`select public.my_access() as ok`)).rows[0].ok).toBe(true);
    });
  });
});

describe('tier gating (E-18)', () => {
  const U = '00000000-0000-0000-0000-0000000000f2';
  const job = '00000000-0000-0000-0000-0000000000f3';
  const setTier = async (tier: string) => {
    await db.exec(`insert into auth.users(id) values ('${U}') on conflict do nothing;
      insert into public.profiles(user_id) values ('${U}') on conflict do nothing;
      insert into public.generation_jobs(id, user_id, kind) values ('${job}', '${U}', 'nutrition_plan') on conflict do nothing;
      insert into public.entitlements(user_id, tier, status, current_period_end)
        values ('${U}', '${tier}', 'active', now() + interval '10 days')
        on conflict (user_id) do update set tier = excluded.tier, status = 'active', current_period_end = excluded.current_period_end`);
  };
  const swap = `insert into public.meal_swaps(user_id, job_id, day_index, meal_index, from_slug, to_slug) values ('${U}', '${job}', 0, 0, 'a', 'b')`;
  const shop = `insert into public.shopping_list_items(user_id, label, job_id) values ('${U}', 'Oats', '${job}')`;

  it('Basic cannot write meal swaps or shopping rows; Pro can', async () => {
    await setTier('basic');
    await expect(asUser(db, U, () => db.query(swap))).rejects.toThrow(/row-level security/);
    await expect(asUser(db, U, () => db.query(shop))).rejects.toThrow(/row-level security/);
    await setTier('pro');
    await asUser(db, U, () => db.query(swap));
    await asUser(db, U, () => db.query(shop));
    const rows = await asUser(db, U, async () => (await db.query('select * from public.meal_swaps')).rows);
    expect(rows).toHaveLength(1);
  });
  it('a lapsed subscriber keeps reading their rows but cannot write new ones', async () => {
    await db.exec(`update public.entitlements set status = 'canceled' where user_id = '${U}'`);
    const rows = await asUser(db, U, async () => (await db.query('select * from public.shopping_list_items')).rows);
    expect(rows).toHaveLength(1);
    await expect(asUser(db, U, () => db.query(shop.replace("'Oats'", "'Rice'")))).rejects.toThrow(/row-level security/);
  });
  it('weekly_adjust is Elite-only', async () => {
    const access = async (f: string) => (await db.query<{ ok: boolean }>(`select public.has_access('${U}', '${f}') as ok`)).rows[0].ok;
    await setTier('pro');
    expect(await access('weekly_adjust')).toBe(false);
    await setTier('elite');
    expect(await access('weekly_adjust')).toBe(true);
  });
  it('signed-in users cannot call has_access directly, only my_access', async () => {
    await expect(asUser(db, U, () => db.query(`select public.has_access('${U}')`))).rejects.toThrow(/permission denied/);
    const ok = await asUser(db, U, async () => (await db.query<{ ok: boolean }>(`select public.my_access('workouts') as ok`)).rows[0].ok);
    expect(ok).toBe(true);
  });
  it('plan_prices is readable by everyone and seeded with the six default prices', async () => {
    const rows = await asUser(db, U, async () => (await db.query('select * from public.plan_prices')).rows);
    expect(rows).toHaveLength(6);
    await expect(asUser(db, U, () => db.query(`update public.plan_prices set cents = 1`))).resolves.toMatchObject({ affectedRows: 0 });
  });
});

describe('instrumentation (E-29)', () => {
  it('creates a signup analytics event with the provider on first sign-in', async () => {
    const id = '00000000-0000-0000-0000-0000000000a1';
    await db.exec(`insert into auth.users(id, email, raw_app_meta_data) values ('${id}', 'g@x.co', '{"provider":"google"}')`);
    const r = await db.query<{ name: string; props: { method: string } }>(`select name, props from public.analytics_events where user_id = '${id}'`);
    expect(r.rows).toEqual([{ name: 'signup', props: { method: 'google' } }]);
    const id2 = '00000000-0000-0000-0000-0000000000a2';
    await db.exec(`insert into auth.users(id, email) values ('${id2}', 'e@x.co')`);
    const r2 = await db.query<{ props: { method: string } }>(`select props from public.analytics_events where user_id = '${id2}'`);
    expect(r2.rows[0].props.method).toBe('email');
  });

  it('purges guardrail text after the retention window or once reviewed, and keeps the counts', async () => {
    await db.exec(`insert into public.guardrail_events(user_id, field, rule, action, input_text, created_at) values
      ('${A}', 'notes', 'injection', 'blocked', 'old text', now() - interval '40 days'),
      ('${A}', 'notes', 'injection', 'blocked', 'fresh text', now()),
      ('${A}', 'notes', 'off_topic', 'dropped', 'reviewed text', now())`);
    await db.exec(`update public.guardrail_events set reviewed_at = now() where input_text = 'reviewed text'`);
    const n = (await db.query<{ n: number }>(`select public.purge_guardrail_text(30) as n`)).rows[0].n;
    expect(n).toBe(2);
    const rows = await db.query<{ input_text: string | null }>(`select input_text from public.guardrail_events where field = 'notes' order by created_at`);
    expect(rows.rows.map((r) => r.input_text).filter(Boolean)).toEqual(['fresh text']);
    expect(rows.rows).toHaveLength(3);
    await expect(asUser(db, A, () => db.query('select public.purge_guardrail_text(1)'))).rejects.toThrow(/permission denied/);
  });

  it('admin views aggregate per day and show nothing to signed-in users', async () => {
    await db.exec(`insert into public.analytics_events(user_id, anon_id, name) values
      (null, 'visitor-aaaa', 'paywall_view'), (null, 'visitor-aaaa', 'paywall_view'), (null, 'visitor-bbbb', 'paywall_view');
      insert into public.ai_call_logs(user_id, role, model, tokens_in, tokens_out, cost_usd, latency_ms, status, qa_result, retry, escalated, refusal) values
      ('${A}', 'qa', 'm', 100, 50, 0.002, 200, 'ok', 'fail', 1, true, false),
      ('${A}', 'qa', 'm', 100, 50, 0.004, 400, 'invalid_output', null, 0, false, true);
      insert into public.revenue_daily(day, tier, gross_usd, fees_usd, refunds_usd) values (current_date, 'pro', 100, 5, 10)`);
    const funnel = await db.query<{ events: number; visitors: number }>(`select events, visitors from public.analytics_funnel_daily where name = 'paywall_view'`);
    expect(funnel.rows).toEqual([{ events: 3, visitors: 2 }]);
    const ai = await db.query<Record<string, number>>(`select calls, tokens_in, errors, escalated_calls, refusals, qa_fails, retried_calls, avg_latency_ms, cost_usd::float as cost_usd from public.ai_usage_daily where model = 'm'`);
    expect(ai.rows[0]).toMatchObject({ calls: 2, tokens_in: 200, errors: 1, escalated_calls: 1, refusals: 1, qa_fails: 1, retried_calls: 1, avg_latency_ms: 300, cost_usd: 0.006 });
    // One of the two blocked rows was backdated 40 days, so the view has one row per day.
    const guard = await db.query<{ day: string; events: number }>(`select day::text, events from public.guardrail_daily where category = 'injection' and action = 'blocked' order by day`);
    expect(guard.rows.map((r) => r.events)).toEqual([1, 1]);
    const rev = await db.query<{ net_usd: string }>(`select net_usd from public.revenue_net_daily`);
    expect(Number(rev.rows[0].net_usd)).toBe(85);
    for (const v of ['analytics_funnel_daily', 'ai_usage_daily', 'guardrail_daily', 'revenue_net_daily']) {
      // The test harness grants blanket table access after the migrations; security_invoker + RLS still return nothing.
      const rows = await asUser(db, A, async () => (await db.query(`select * from public.${v}`)).rows);
      expect(rows, v).toEqual([]);
    }
  });
});
