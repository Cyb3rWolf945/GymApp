// Edge Function: weekly-checkin
// POST { weekStart, weightKg?, energy, sleep, workoutsDone, workoutsPlanned?, note? } with the user's JWT.
// Saves the weekly check-in (one row per user per week; sending again replaces it) and writes the weight to body_metrics.
// The note is free text: it goes through the guardrail pre-filter first and is stored only when cleared, so the
// planner (user_history) never sees an unfiltered note. weekly_checkins is service-role write for that reason.
import { createClient } from '@supabase/supabase-js';
import {
  type AiCallLog,
  aiCallRow,
  guardrailRow,
  callStructured,
  getRuntimeModelProfile,
  runGuardrails,
} from '../../../packages/shared/src/ai/index.ts';
import { CheckinInputSchema, isCurrentWeek } from '../../../packages/shared/src/checkin/index.ts';
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

  const parsed = CheckinInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid check-in.' });
  const c = parsed.data;
  if (!isCurrentWeek(c.weekStart, new Date())) return json(400, { error: 'Invalid check-in week.' });

  // Note: guardrail pre-filter. Anything not cleared is dropped; the numbers are still saved.
  let note: string | null = null;
  if (c.note?.trim()) {
    const cfg = {
      profile: getRuntimeModelProfile(Deno.env.get('MODEL_PROFILE'), Deno.env.get('APP_ENV')),
      apiKey: Deno.env.get('OPENROUTER_API_KEY') ?? 'proxy-injected',
      // Metadata only: never the note itself.
      log: async (l: AiCallLog) => {
        await admin.from('ai_call_logs').insert(aiCallRow(l));
      },
    };
    const guard = await runGuardrails({
      call: ((x: Parameters<typeof callStructured>[1]) => callStructured(cfg, x)) as never,
      fields: { notes: c.note },
      userId: user.id,
      jobId: `checkin-${c.weekStart}`,
    });
    if (guard.events.length > 0) {
      await admin.from('guardrail_events').insert(guard.events.map((e) => guardrailRow(user.id, null, e)));
    }
    note = guard.notes?.trim() || null;
  }

  const { error } = await admin.from('weekly_checkins').upsert(
    {
      user_id: user.id,
      week_start: c.weekStart,
      weight_kg: c.weightKg ?? null,
      energy: c.energy,
      sleep: c.sleep,
      workouts_done: c.workoutsDone,
      workouts_planned: c.workoutsPlanned,
      note,
    },
    { onConflict: 'user_id,week_start' },
  );
  if (error) return json(500, { error: 'Could not save the check-in.' });

  if (c.weightKg !== undefined) {
    const today = new Date().toISOString().slice(0, 10);
    await admin.from('body_metrics').upsert({ user_id: user.id, measured_on: today, weight_kg: c.weightKg }, { onConflict: 'user_id,measured_on' });
  }
  return json(200, { ok: true, noteKept: note !== null });
}, () => originsFromEnv((k) => Deno.env.get(k))));
