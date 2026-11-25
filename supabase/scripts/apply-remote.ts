// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... pnpm tsx supabase/scripts/apply-remote.ts [--print-env]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VERIFY_SQL,
  applyFiles,
  managementQuery,
  orderFiles,
  type SqlFile,
} from '../../packages/shared/src/db/apply-remote';

const ref = process.env.SUPABASE_PROJECT_REF ?? 'qcmpzjopinnqfmbkpqnp';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN (use "proxy-injected" in the agent environment).');

const load = (dir: string): SqlFile[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));

async function main() {
  const query = managementQuery(ref, token!);
  const files = orderFiles(load('supabase/migrations'), load('supabase/seed'));
  const { applied, skipped } = await applyFiles(query, files);
  console.log(`applied: ${applied.length ? applied.join(', ') : '-'}`);
  console.log(`skipped: ${skipped.length}`);
  console.log('verify:', JSON.stringify(await query(VERIFY_SQL)));

  if (process.argv.includes('--print-env')) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`api-keys ${res.status}`);
    const keys = (await res.json()) as { name: string; api_key: string }[];
    const anon = keys.find((k) => k.name === 'anon')?.api_key ?? '';
    // Printed to the terminal only. Never commit these values.
    console.log(`EXPO_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co`);
    console.log(`EXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
  }
}
void main();
