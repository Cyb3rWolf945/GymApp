// Edge Function: send-reminders. Run once an hour (scheduled invocation) with the service-role key as bearer token.
// Sends the workout-day reminder to every enabled device whose local reminder hour it is right now,
// on a training day of that user's plan, if they have not trained yet today. At most one per device per day.
import { createClient } from '@supabase/supabase-js';
import {
  EXPO_PUSH_URL,
  EXPO_TOKEN_PATTERN,
  type ExpoTicket,
  type PushMessage,
  chunkMessages,
  deadTokens,
  decideReminder,
  localDateKey,
  pushMessage,
} from '../../../packages/shared/src/notifications/index.ts';
import type { Weekday } from '../../../packages/shared/src/plan/today.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Candidate {
  user_id: string;
  token_id: string;
  token: string;
  tz: string;
  local_date: string;
  iso_weekday: number;
  display_name: string | null;
}

Deno.serve(async (req) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${key}`) return json(401, { error: 'Not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key); // server only

  const now = new Date();
  const { data, error } = await admin.rpc('reminder_candidates', { p_now: now.toISOString() });
  if (error) return json(500, { error: 'Could not load reminders.' });
  const candidates = ((data ?? []) as Candidate[]).filter((c) => EXPO_TOKEN_PATTERN.test(c.token));
  if (candidates.length === 0) return json(200, { ok: true, candidates: 0, sent: 0 });

  const userIds = [...new Set(candidates.map((c) => c.user_id))];
  const [{ data: jobs }, { data: profiles }, { data: sessions }] = await Promise.all([
    admin.from('generation_jobs').select('user_id,result,created_at').in('user_id', userIds).eq('kind', 'workout_plan').eq('status', 'done').order('created_at', { ascending: false }),
    admin.from('profiles').select('user_id,onboarding').in('user_id', userIds),
    admin.from('workout_sessions').select('user_id,started_at').in('user_id', userIds).gte('started_at', new Date(now.getTime() - 36 * 3600_000).toISOString()),
  ]);
  const planOf = new Map<string, unknown>();
  for (const j of (jobs ?? []) as { user_id: string; result: unknown }[]) if (!planOf.has(j.user_id)) planOf.set(j.user_id, j.result);
  const preferredOf = new Map(((profiles ?? []) as { user_id: string; onboarding: { preferredDays?: Weekday[] } | null }[]).map((p) => [p.user_id, p.onboarding?.preferredDays]));

  const due: { c: Candidate; message: PushMessage }[] = [];
  let skipped = 0;
  for (const c of candidates) {
    // "Trained today" is judged in the device's own time zone.
    const trainedToday = ((sessions ?? []) as { user_id: string; started_at: string }[]).some((s) => s.user_id === c.user_id && localDateKey(s.started_at, c.tz) === c.local_date);
    const d = decideReminder({ workoutResult: planOf.get(c.user_id), preferredDays: preferredOf.get(c.user_id) ?? [], isoWeekday: c.iso_weekday, trainedToday, name: c.display_name });
    if (d.send && d.message) due.push({ c, message: pushMessage(c.token, d.message) });
    else skipped += 1;
  }

  let sent = 0;
  const dead: string[] = [];
  for (const batch of chunkMessages(due)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
      },
      body: JSON.stringify(batch.map((b) => b.message)),
    }).catch(() => null);
    if (!res?.ok) continue; // try again at the next run
    const tickets = ((await res.json().catch(() => ({ data: [] }))) as { data?: ExpoTicket[] }).data ?? [];
    dead.push(...deadTokens(batch.map((b) => b.message), tickets));
    // Mark the day as done for every token Expo accepted.
    const ok = batch.filter((_, i) => tickets[i]?.status === 'ok');
    sent += ok.length;
    for (const b of ok) await admin.from('push_tokens').update({ last_sent_on: b.c.local_date }).eq('id', b.c.token_id);
  }
  if (dead.length > 0) await admin.from('push_tokens').update({ enabled: false }).in('token', dead);
  return json(200, { ok: true, candidates: candidates.length, sent, skipped, disabled: dead.length });
});
