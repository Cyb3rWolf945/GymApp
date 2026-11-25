// Applies supabase/migrations then supabase/seed to a remote project through the
// Supabase Management API. Idempotent: applied files are recorded in _applied_migrations.

export type QueryFn = (sql: string) => Promise<unknown[]>;

export interface SqlFile {
  name: string;
  sql: string;
}

const TRACKING_TABLE = `create table if not exists public._applied_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public._applied_migrations enable row level security;`;

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Files in apply order: migrations first, then seed; each group sorted by name. */
export function orderFiles(migrations: SqlFile[], seeds: SqlFile[]): SqlFile[] {
  const byName = (a: SqlFile, b: SqlFile) => a.name.localeCompare(b.name);
  return [
    ...[...migrations].sort(byName).map((f) => ({ ...f, name: `migrations/${f.name}` })),
    ...[...seeds].sort(byName).map((f) => ({ ...f, name: `seed/${f.name}` })),
  ];
}

/** File and its tracking row run in one request, so a failure leaves nothing half-applied. */
export function wrapFile(file: SqlFile): string {
  return `begin;\n${file.sql}\ninsert into public._applied_migrations (name) values (${quote(file.name)});\ncommit;`;
}

export async function applyFiles(query: QueryFn, files: SqlFile[]) {
  await query(TRACKING_TABLE);
  const rows = (await query('select name from public._applied_migrations')) as { name: string }[];
  const done = new Set(rows.map((r) => r.name));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    if (done.has(file.name)) {
      skipped.push(file.name);
      continue;
    }
    await query(wrapFile(file));
    applied.push(file.name);
  }
  return { applied, skipped };
}

export function managementQuery(
  ref: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): QueryFn {
  return async (sql) => {
    const res = await fetchFn(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
    return JSON.parse(body) as unknown[];
  };
}

export const VERIFY_SQL = `select
  (select count(*) from public.exercises) as exercises,
  (select count(*) from public.ingredients) as ingredients,
  (select count(*) from public.recipes) as recipes,
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as tables_without_rls`;
