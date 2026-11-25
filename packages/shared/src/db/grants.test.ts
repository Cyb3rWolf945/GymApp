import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './harness';

// E-61. On a live Supabase project the API roles start with no table privileges, so RLS policies only apply if a
// migration grants them. The harness creates the roles the same way (no default grants), so these tests fail the
// same way production would.

const PRIVS = ['select', 'insert', 'update', 'delete'] as const;
type Priv = (typeof PRIVS)[number];
const ROLES = ['anon', 'authenticated'] as const;

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
}, 60_000);
afterAll(() => db.close());

/** What the policies allow, per role and table (a policy for `public` covers both roles). */
async function policyPrivs(): Promise<Map<string, Set<Priv>>> {
  const { rows } = await db.query<{ tablename: string; cmd: string; roles: string }>(
    `select tablename, cmd, roles::text as roles from pg_policies where schemaname = 'public'`,
  );
  const out = new Map<string, Set<Priv>>();
  for (const r of rows) {
    const roles = r.roles.replace(/[{}]/g, '').split(',');
    for (const role of ROLES) {
      if (!roles.includes(role) && !roles.includes('public')) continue;
      const key = `${role}.${r.tablename}`;
      const set = out.get(key) ?? new Set<Priv>();
      for (const p of r.cmd === 'ALL' ? PRIVS : [r.cmd.toLowerCase() as Priv]) set.add(p);
      out.set(key, set);
    }
  }
  return out;
}

async function relations(): Promise<string[]> {
  const { rows } = await db.query<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'p') order by 1`,
  );
  return rows.map((r) => r.relname);
}

async function has(role: string, rel: string, priv: Priv): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(`select has_table_privilege('${role}', 'public.${rel}', '${priv}') as ok`);
  return rows[0].ok;
}

describe('role grants (E-61)', () => {
  it('every table with a policy for a role grants that role the matching privilege', async () => {
    const allowed = await policyPrivs();
    const missing: string[] = [];
    for (const [key, privs] of allowed) {
      const [role, rel] = key.split('.');
      for (const p of privs) if (!(await has(role, rel, p))) missing.push(`${role} ${p} on ${rel}`);
    }
    expect(missing).toEqual([]);
  });

  it('grants nothing beyond what the policies cover, and nothing at all on tables and views without a policy', async () => {
    const allowed = await policyPrivs();
    const extra: string[] = [];
    for (const rel of await relations()) {
      for (const role of ROLES) {
        const covered = allowed.get(`${role}.${rel}`) ?? new Set<Priv>();
        for (const p of PRIVS) if ((await has(role, rel, p)) && !covered.has(p)) extra.push(`${role} ${p} on ${rel}`);
      }
    }
    expect(extra).toEqual([]);
  });

  it('visitors (anon) can only read plan_prices', async () => {
    const anon: string[] = [];
    for (const rel of await relations()) for (const p of PRIVS) if (await has('anon', rel, p)) anon.push(`${p} ${rel}`);
    expect(anon).toEqual(['select plan_prices']);
  });

  it('every public table has RLS enabled', async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it('the server role reaches every table and view', async () => {
    const denied: string[] = [];
    for (const rel of await relations()) for (const p of PRIVS) if (!(await has('service_role', rel, p))) denied.push(`${p} ${rel}`);
    expect(denied).toEqual([]);
  });

  it('a table created later is open to service_role only until its migration grants the others', async () => {
    await db.exec(`create table public.later_table (id int primary key); alter table public.later_table enable row level security`);
    expect(await has('service_role', 'later_table', 'insert')).toBe(true);
    for (const role of ROLES) for (const p of PRIVS) expect(await has(role, 'later_table', p), `${role} ${p}`).toBe(false);
    await db.exec(`drop table public.later_table`);
  });

  it('keeps function EXECUTE closed to signed-in users where earlier migrations closed it', async () => {
    for (const fn of ['has_access(uuid, text)', 'erase_user_traces(uuid)', 'purge_guardrail_text(int)']) {
      const { rows } = await db.query<{ ok: boolean }>(`select has_function_privilege('authenticated', 'public.${fn}', 'execute') as ok`);
      expect(rows[0].ok, fn).toBe(false);
    }
  });
});
