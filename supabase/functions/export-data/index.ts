// Edge Function: export-data. POST with the user's JWT -> a JSON document with everything we hold about them
// (GDPR access and portability). Only the caller's own rows; the table list is checked against the schema in tests.
import { createClient } from '@supabase/supabase-js';
import { EXPORT_TABLES, buildExport } from '../../../packages/shared/src/legal/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json(401, { error: 'Sign in to continue.' });

  const tables: Record<string, unknown[] | null> = {};
  for (const t of EXPORT_TABLES) {
    // `user_id = caller` is the only filter: never another person's rows.
    const { data, error } = await admin.from(t).select('*').eq('user_id', user.id).limit(50_000);
    if (error) return json(500, { error: "Couldn't build your export. Try again in a minute." });
    tables[t] = data;
  }
  return json(200, buildExport(user.id, user.email ?? null, tables), { 'Cache-Control': 'no-store' });
});
