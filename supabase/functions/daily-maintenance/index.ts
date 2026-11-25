// Edge Function: daily-maintenance. Run once a day (scheduled invocation) with the service-role key as bearer token.
// Removes guardrail text past its retention window (30 days) or already reviewed; the counts stay.
// Also closes generation jobs that were queued or running for over 5 minutes (the function that ran them died).
import { createClient } from '@supabase/supabase-js';
import { sweepStaleJobs } from '../../../packages/shared/src/ai/sweep.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${key}`) return json(401, { error: 'Not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key); // server only
  const swept = await sweepStaleJobs(admin as never);
  const { data, error } = await admin.rpc('purge_guardrail_text', { p_days: 30 });
  return error ? json(500, { error: 'Could not purge.' }) : json(200, { ok: true, purged: data, swept });
});
