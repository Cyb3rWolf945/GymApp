// Edge Function: workout-feedback
// POST { sessionId, rating?, note? } with the user's JWT, after a workout.
// The rating is stored on the session. The note is free text: it goes through the guardrail pre-filter
// first, and only a cleared note becomes a memory fact for the planner (memory_facts is service-role write).
import { createClient } from '@supabase/supabase-js';
import {
  type AiCallLog,
  FeedbackSchema,
  aiCallRow,
  guardrailRow,
  callStructured,
  getRuntimeModelProfile,
  runGuardrails,
} from '../../../packages/shared/src/ai/index.ts';
import { originsFromEnv, withCors } from '../../../packages/shared/src/http/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json(401, { error: 'Sign in to continue.' });

  const parsed = FeedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid feedback.' });
  const { sessionId, rating, note } = parsed.data;

  // The session must be the caller's own.
  const { data: session } = await admin.from('workout_sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle();
  if (!session) return json(404, { error: 'Workout not found.' });

  if (rating !== undefined) await admin.from('workout_sessions').update({ rating }).eq('id', sessionId);

  let remembered = false;
  if (note?.trim()) {
    const profile = getRuntimeModelProfile(Deno.env.get('MODEL_PROFILE'), Deno.env.get('APP_ENV'));
    const cfg = {
      profile,
      apiKey: Deno.env.get('OPENROUTER_API_KEY') ?? 'proxy-injected',
      // Metadata only: never the note itself.
      log: async (l: AiCallLog) => {
        await admin.from('ai_call_logs').insert(aiCallRow(l));
      },
    };
    const guard = await runGuardrails({
      call: ((c: Parameters<typeof callStructured>[1]) => callStructured(cfg, c)) as never,
      fields: { notes: note },
      userId: user.id,
      jobId: sessionId,
    });
    if (guard.events.length > 0) {
      await admin.from('guardrail_events').insert(guard.events.map((e) => guardrailRow(user.id, null, e)));
    }
    if (guard.notes) {
      const { error } = await admin.from('memory_facts').insert({ user_id: user.id, kind: 'workout_feedback', fact: guard.notes });
      remembered = !error;
    }
  }
  return json(200, { ok: true, remembered });
}, () => originsFromEnv((k) => Deno.env.get(k))));
