import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXPORT_TABLES } from '../legal/export';
import { trackingAllowed } from '../marketing/capi';
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
  'nutrition_plans','meals','shopping_list_items','body_metrics','profiles','entitlements','generation_jobs','memory_facts','plan_swaps','meal_swaps','consent_records','push_tokens'];
const adminTables = ['ai_call_logs','guardrail_events','analytics_events','admins','admin_audit_log',
  'prompt_versions','eval_runs','ad_creatives','ad_insights_daily','cost_entries','revenue_daily','stripe_events'];
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

describe('GDPR (E-21)', () => {
  const U = '00000000-0000-0000-0000-0000000000d1';
  const V = '00000000-0000-0000-0000-0000000000d2';

  it('consent records: own rows only, append-only for users, one per kind and version', async () => {
    await db.exec(`insert into auth.users(id) values ('${U}'), ('${V}') on conflict do nothing`);
    await asUser(db, U, () => db.query(`insert into public.consent_records(user_id, kind, version, accepted) values ('${U}', 'health_data', 'v1', true)`));
    await expect(asUser(db, U, () => db.query(`insert into public.consent_records(user_id, kind, version, accepted) values ('${V}', 'terms', 'v1', true)`))).rejects.toThrow(/row-level security/);
    await expect(asUser(db, U, () => db.query(`insert into public.consent_records(user_id, kind, version, accepted) values ('${U}', 'health_data', 'v1', true)`))).rejects.toThrow(/duplicate key/);
    await expect(asUser(db, U, () => db.query(`insert into public.consent_records(user_id, kind, version, accepted) values ('${U}', 'cookies', 'v1', true)`))).rejects.toThrow(/check/);
    expect((await asUser(db, U, () => db.query(`update public.consent_records set accepted = false`))).affectedRows).toBe(0);
    expect((await asUser(db, U, () => db.query(`delete from public.consent_records`))).affectedRows).toBe(0);
    expect(await asUser(db, V, async () => (await db.query(`select * from public.consent_records`)).rows)).toEqual([]);
  });

  it('the export covers every table that holds user data', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select c.table_name from information_schema.columns c
         join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
        where c.table_schema = 'public' and c.column_name = 'user_id'`,
    );
    // admins is staff, not users' data. Everything else with a user_id must be exported.
    const holders = rows.map((r) => r.table_name).filter((t) => t !== 'admins');
    expect(holders.filter((t) => !(EXPORT_TABLES as readonly string[]).includes(t))).toEqual([]);
    for (const t of EXPORT_TABLES) expect(holders, t).toContain(t);
  });

  it('deleting the account (erase traces + delete the auth user) leaves no row about the user', async () => {
    const D = '00000000-0000-0000-0000-0000000000d3';
    const job = '00000000-0000-0000-0000-0000000000d4';
    await db.exec(`insert into auth.users(id) values ('${D}');
      insert into public.profiles(user_id) values ('${D}') on conflict do nothing;
      insert into public.entitlements(user_id, tier, status) values ('${D}', 'pro', 'active');
      insert into public.body_metrics(user_id, weight_kg) values ('${D}', 80);
      insert into public.generation_jobs(id, user_id, kind) values ('${job}', '${D}', 'workout_plan');
      insert into public.memory_facts(user_id, kind, fact) values ('${D}', 'x', 'y');
      insert into public.consent_records(user_id, kind, version, accepted) values ('${D}', 'terms', 'v1', true);
      insert into public.meal_swaps(user_id, job_id, day_index, meal_index, from_slug, to_slug) values ('${D}', '${job}', 0, 0, 'a', 'b');
      insert into public.guardrail_events(user_id, rule, action, input_text) values ('${D}', 'injection', 'blocked', 'my knee hurts');
      insert into public.analytics_events(user_id, name) values ('${D}', 'paywall_view');
      insert into public.ai_call_logs(user_id, model, status) values ('${D}', 'm', 'ok');`);
    await db.query(`select public.erase_user_traces('${D}')`);
    await db.exec(`delete from auth.users where id = '${D}'`);

    const { rows } = await db.query<{ table_name: string }>(
      `select c.table_name from information_schema.columns c
         join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
        where c.table_schema = 'public' and c.column_name = 'user_id'`,
    );
    for (const { table_name } of rows) {
      const left = await db.query<{ n: number }>(`select count(*)::int as n from public.${table_name} where user_id = '${D}'`);
      expect(left.rows[0].n, table_name).toBe(0);
    }
    // The ones with `on delete set null` must not keep the person's text either.
    expect((await db.query(`select * from public.guardrail_events where input_text = 'my knee hurts'`)).rows).toEqual([]);
  });

  it('only the service role can erase traces', async () => {
    await expect(asUser(db, U, () => db.query(`select public.erase_user_traces('${U}')`))).rejects.toThrow(/permission denied/);
  });
});

describe('web funnel (E-22)', () => {
  const U = '00000000-0000-0000-0000-0000000000e1';
  it('profiles keep first-touch attribution as JSON, empty by default', async () => {
    await db.exec(`insert into auth.users(id) values ('${U}') on conflict do nothing; insert into public.profiles(user_id) values ('${U}') on conflict do nothing`);
    expect((await db.query<{ attribution: object }>(`select attribution from public.profiles where user_id = '${U}'`)).rows[0].attribution).toEqual({});
    await asUser(db, U, () => db.query(`update public.profiles set attribution = '{"utm_source":"meta"}' where user_id = '${U}'`));
    expect((await db.query<{ attribution: { utm_source: string } }>(`select attribution from public.profiles where user_id = '${U}'`)).rows[0].attribution.utm_source).toBe('meta');
  });
  it('the tracking consent can be recorded, accepted or rejected, and trackingAllowed reads it', async () => {
    await asUser(db, U, () => db.query(`insert into public.consent_records(user_id, kind, version, accepted) values ('${U}', 'marketing', '1', false)`));
    const rows = await asUser(db, U, async () => (await db.query<{ kind: string; accepted: boolean; accepted_at: string }>(`select kind, accepted, accepted_at::text from public.consent_records where kind = 'marketing'`)).rows);
    expect(trackingAllowed(rows)).toBe(false);
    await asUser(db, U, () => db.query(`insert into public.consent_records(user_id, kind, version, accepted, accepted_at) values ('${U}', 'marketing', '2', true, now() + interval '1 minute')`));
    const after = await asUser(db, U, async () => (await db.query<{ kind: string; accepted: boolean; accepted_at: string }>(`select kind, accepted, accepted_at::text from public.consent_records where kind = 'marketing'`)).rows);
    expect(trackingAllowed(after)).toBe(true);
  });
});

describe('admin metrics views (E-31)', () => {
  const A1 = '00000000-0000-0000-0000-0000000000c1';
  const A2 = '00000000-0000-0000-0000-0000000000c2';

  it('stitches a visitor across anonymous and signed-in events and attributes the source', async () => {
    await db.exec(`insert into auth.users(id) values ('${A1}'), ('${A2}') on conflict do nothing;
      insert into public.profiles(user_id, attribution) values ('${A1}', '{"utm_source":"meta","utm_campaign":"launch"}') on conflict (user_id) do update set attribution = excluded.attribution;
      insert into public.profiles(user_id) values ('${A2}') on conflict do nothing;
      insert into public.analytics_events(user_id, anon_id, name, props) values
        (null, 'visitor-meta-1', 'landing_view', '{"utm_source":"meta","utm_campaign":"launch"}'),
        (null, 'visitor-meta-1', 'quiz_start', '{}'),
        (null, 'visitor-meta-1', 'onboarding_step_viewed', '{"step":"goal","screen":2,"version":1}'),
        (null, 'visitor-meta-1', 'onboarding_step_viewed', '{"step":"basics","screen":3,"version":1}'),
        ('${A1}', 'visitor-meta-1', 'paywall_view', '{}'),
        ('${A1}', null, 'purchase', '{"tier":"pro","interval":"year","amount_usd":119.99,"reason":"subscription_cycle"}'),
        (null, 'visitor-direct-2', 'quiz_start', '{}'),
        (null, 'visitor-direct-2', 'onboarding_step_viewed', '{"step":"goal","screen":2,"version":1}'),
        ('${A2}', null, 'signup', '{"method":"email"}')`);
    const f = await db.query<{ source: string; name: string; visitors: number; events: number }>(`select source, name, visitors, events from public.funnel_by_source_daily where source in ('meta', '(direct)') order by source, name`);
    const get = (source: string, name: string) => f.rows.find((r) => r.source === source && r.name === name);
    // The purchase has only a user id, but belongs to the same visitor as the quiz: one visitor, source meta.
    expect(get('meta', 'purchase')).toMatchObject({ visitors: 1 });
    expect(get('meta', 'quiz_start')).toMatchObject({ visitors: 1 });
    expect(get('meta', 'paywall_view')).toMatchObject({ visitors: 1 });
    expect(get('(direct)', 'quiz_start')).toMatchObject({ visitors: 1 });
    // One visitor, one journey: the signup (written by a trigger) and the purchase have only a user id, yet they join
    // the anonymous quiz events of the same person and share their source.
    const journey = await db.query<{ source: string; names: string[] }>(`select source, array_agg(distinct name order by name) as names from public.analytics_events_attributed where visitor = 'visitor-meta-1' group by source`);
    expect(journey.rows).toEqual([{ source: 'meta', names: ['landing_view', 'onboarding_step_viewed', 'paywall_view', 'purchase', 'quiz_start', 'signup'] }]);

    const screens = await db.query<{ source: string; screen: number; visitors: number }>(`select source, screen, visitors from public.onboarding_screens_daily order by source, screen`);
    expect(screens.rows).toEqual([
      { source: '(direct)', screen: 2, visitors: 1 },
      { source: 'meta', screen: 2, visitors: 1 },
      { source: 'meta', screen: 3, visitors: 1 },
    ]);
  });

  it('summarises generations per day and flattens their attempts', async () => {
    const snap = async () => (await db.query<Record<string, number>>(`select coalesce(sum(jobs),0)::int jobs, coalesce(sum(done),0)::int done, coalesce(sum(failed),0)::int failed, coalesce(sum(first_pass),0)::int first_pass, coalesce(sum(retried),0)::int retried, coalesce(sum(escalated),0)::int escalated, coalesce(sum(fallback),0)::int fallback, coalesce(sum(needs_review),0)::int needs_review from public.generation_daily`)).rows[0];
    const before = await snap();
    const result = (source: string, outcomes: string[]) => JSON.stringify({ source, attempts: outcomes.map((o) => ({ stage: 'planner', outcome: o, errors: o === 'validation_failed' ? ['Day 1: "x" contains nuts.'] : [] })) });
    await db.exec(`insert into public.generation_jobs(user_id, kind, status, result, needs_review) values
      ('${A1}', 'workout_plan', 'done', '${result('planner', ['passed'])}', false),
      ('${A1}', 'nutrition_plan', 'done', '${result('planner', ['validation_failed', 'passed'])}', false),
      ('${A2}', 'workout_plan', 'done', '${result('template', ['validation_failed', 'validation_failed', 'validation_failed'])}', true),
      ('${A2}', 'nutrition_plan', 'failed', null, false),
      ('${A2}', 'workout_plan', 'done', '${result('escalation', ['qa_failed', 'passed'])}', false)`);
    const after = await snap();
    const diff = Object.fromEntries(Object.keys(after).map((k) => [k, after[k] - before[k]]));
    expect(diff).toEqual({ jobs: 5, done: 4, failed: 1, first_pass: 1, retried: 3, escalated: 1, fallback: 1, needs_review: 1 });

    const outcomes = await db.query<{ outcome: string; n: number }>(`select outcome, count(*)::int as n from public.generation_attempts where job_id in (select id from public.generation_jobs where user_id = '${A2}' and result is not null) group by 1 order by 1`);
    expect(outcomes.rows).toEqual([{ outcome: 'passed', n: 1 }, { outcome: 'qa_failed', n: 1 }, { outcome: 'validation_failed', n: 3 }]);
    const errs = await db.query<{ n: number }>(`select count(*)::int as n from public.generation_attempts where errors @> '["Day 1: \\"x\\" contains nuts."]'::jsonb`);
    expect(errs.rows[0].n).toBe(4); // 1 + 3 validation failures carry the message (QA failures and failed jobs have none)
  });

  it('computes latency percentiles per role', async () => {
    await db.exec(`insert into public.ai_call_logs(user_id, role, model, latency_ms, status) values
      ('${A1}', 'light', 'm', 100, 'ok'), ('${A1}', 'light', 'm', 200, 'ok'), ('${A1}', 'light', 'm', 300, 'ok'), ('${A1}', 'light', 'm', 400, 'ok'), ('${A1}', 'light', 'm', 1000, 'ok')`);
    const r = await db.query<{ calls: number; p50_ms: number; p95_ms: number }>(`select calls, p50_ms, p95_ms from public.ai_latency_daily where role = 'light'`);
    expect(r.rows[0]).toMatchObject({ calls: 5, p50_ms: 300 });
    expect(r.rows[0].p95_ms).toBeGreaterThan(800);
  });

  it('only reveals what the underlying tables reveal to a signed-in user (the real database also revokes access)', async () => {
    // Built on admin-only tables (RLS, no policy): empty for a signed-in user.
    for (const v of ['analytics_events_attributed', 'funnel_by_source_daily', 'onboarding_screens_daily', 'ai_latency_daily']) {
      const rows = await asUser(db, A1, async () => (await db.query(`select * from public.${v}`)).rows);
      expect(rows, v).toEqual([]);
    }
    // Built on generation_jobs, whose own-row policy applies: a user only ever sees their own jobs, never another user's.
    const mine = await asUser(db, A1, async () => (await db.query<{ n: number }>(`select coalesce(sum(jobs), 0)::int as n from public.generation_daily`)).rows[0].n);
    expect(mine).toBe(2);
  });
});

describe('admin users and guardrails queue (E-32)', () => {
  const U1 = '00000000-0000-0000-0000-0000000000b1';
  const U2 = '00000000-0000-0000-0000-0000000000b2';
  const search = async (q: string | null) => (await db.query<{ id: string; email: string; tier: string; status: string; last_active: string | null }>(`select id, email, tier, status, last_active::text from public.admin_user_list(${q === null ? 'null' : `'${q.replace(/'/g, "''")}'`}, 50, 0)`)).rows;

  it('lists users with their plan and last activity, and searches by email or id', async () => {
    await db.exec(`insert into auth.users(id, email, last_sign_in_at) values ('${U1}', 'ana.silva@example.test', '2026-11-01T10:00:00Z'), ('${U2}', '50%_off@example.test', null) on conflict (id) do nothing;
      insert into public.profiles(user_id) values ('${U1}'), ('${U2}') on conflict do nothing;
      insert into public.entitlements(user_id, tier, status, current_period_end) values ('${U1}', 'pro', 'active', now() + interval '30 days') on conflict (user_id) do update set tier = 'pro', status = 'active';
      insert into public.workout_sessions(user_id, started_at) values ('${U1}', '2026-11-20T08:00:00Z')`);
    const byEmail = await search('SILVA');
    expect(byEmail.map((u) => u.email)).toEqual(['ana.silva@example.test']);
    expect(byEmail[0]).toMatchObject({ tier: 'pro', status: 'active' });
    expect(byEmail[0].last_active).toContain('2026-11-20'); // the later of the sign-in and the last workout
    expect((await search(U1)).map((u) => u.id)).toEqual([U1]);
    expect((await search(` ${U2.toUpperCase()} `)).map((u) => u.id)).toEqual([U2]);
    const none = (await search('50%_off@example.test'))[0];
    expect(none).toMatchObject({ id: U2, tier: 'none', status: 'none', last_active: null });
    expect((await search(null)).length).toBeGreaterThanOrEqual(2);
    expect((await search('')).length).toBeGreaterThanOrEqual(2);
  });

  it('matches % and _ literally, not as wildcards', async () => {
    expect((await search('%')).map((u) => u.id)).toEqual([U2]); // only the address that really contains a percent sign
    expect((await search('_')).map((u) => u.id)).toEqual([U2]);
    expect(await search('no-such-user')).toEqual([]);
  });

  it('is for the service role only', async () => {
    await expect(asUser(db, U1, () => db.query(`select * from public.admin_user_list(null, 5, 0)`))).rejects.toThrow(/permission denied/);
  });

  it('records the reviewer decision on a guardrail event, from a fixed list', async () => {
    await db.exec(`insert into public.guardrail_events(user_id, rule, action, field, input_text) values ('${U1}', 'injection', 'blocked', 'notes', 'ignore the rules')`);
    const id = (await db.query<{ id: string }>(`select id from public.guardrail_events where input_text = 'ignore the rules'`)).rows[0].id;
    await db.exec(`update public.guardrail_events set review_decision = 'kept_blocked', reviewed_at = now(), reviewed_by = '${U2}' where id = '${id}'`);
    await expect(db.exec(`update public.guardrail_events set review_decision = 'ignored' where id = '${id}'`)).rejects.toThrow(/check/);
    // Reviewed rows lose their text at the next purge, the decision stays.
    await db.query(`select public.purge_guardrail_text(30)`);
    const row = (await db.query<{ input_text: string | null; review_decision: string }>(`select input_text, review_decision from public.guardrail_events where id = '${id}'`)).rows[0];
    expect(row).toEqual({ input_text: null, review_decision: 'kept_blocked' });
  });
});
