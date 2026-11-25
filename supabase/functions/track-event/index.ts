// Edge Function: track-event
// Records funnel events (quiz, onboarding screens, plan preview, paywall, checkout, workouts) before and after sign-up.
// analytics_events is service-role only (RLS), so clients go through here. Only allow-listed names
// events with exactly their typed props are accepted (answers and free text never travel in props). Money and
// identity events (signup, trial_start, purchase) are written by the server only and rejected here.
import { createClient } from '@supabase/supabase-js';
import { ClientTrackSchema } from '../../../packages/shared/src/analytics/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const parsed = ClientTrackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid event.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only

  // Signed-in callers get their user id; the anon key (signed-out) is not a user token.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data } = token ? await admin.auth.getUser(token) : { data: { user: null } };

  const { error } = await admin.from('analytics_events').insert({
    user_id: data.user?.id ?? null,
    anon_id: parsed.data.anonId,
    name: parsed.data.name,
    props: parsed.data.props,
  });
  return error ? json(500, { error: 'Could not record the event.' }) : new Response(null, { status: 204 });
});
