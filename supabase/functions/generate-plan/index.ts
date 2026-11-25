// Edge Function: generate-plan
// POST { kind: 'workout_plan' | 'nutrition_plan' } with the user's JWT.
// Creates a generation_jobs row, returns 202 { jobId }, and runs the LLM call in the background.
// The client polls generation_jobs (RLS: own rows only).
import { createClient } from '@supabase/supabase-js';
import {
  type AiCallLog,
  PLAN_KINDS,
  PlanInputError,
  buildPlanInputs,
  extractFreeText,
  runGuardrails,
  callStructured,
  decideGeneration,
  startOfMonthUtc,
  expandEquipment,
  runPipeline,
  swapSignals,
  getModelProfile,
  aiCallRow,
  guardrailRow,
  type PlanKind,
} from '../../../packages/shared/src/ai/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const STALE_JOB_MS = 5 * 60 * 1000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only

  // Identify the caller from their JWT.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json(401, { error: 'Sign in to continue.' });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as PlanKind;
  if (!PLAN_KINDS.includes(kind)) return json(400, { error: 'Unknown plan kind.' });

  // Access is always checked server-side. Entitled users always; everyone else gets one free
  // generation per kind (failed jobs do not count), so the plan preview can come before the paywall.
  const { data: ent } = await admin.from('entitlements').select('tier,status,current_period_end,past_due_since').eq('user_id', user.id).maybeSingle();
  const { data: month } = await admin
    .from('generation_jobs')
    .select('status')
    .eq('user_id', user.id)
    .gte('created_at', startOfMonthUtc());
  const { data: prior } = await admin
    .from('generation_jobs')
    .select('id,status,created_at')
    .eq('user_id', user.id)
    .eq('kind', kind)
    .order('created_at', { ascending: false });

  // A job stuck in queued/running for over 5 minutes (the function died) counts as failed.
  const jobs = (prior ?? []).map((j: { id: string; status: string; created_at: string }) =>
    (j.status === 'queued' || j.status === 'running') && Date.now() - new Date(j.created_at).getTime() > STALE_JOB_MS
      ? { ...j, status: 'failed' }
      : j,
  );

  // Already on it: return the running job instead of starting another (double taps, reloads).
  const running = jobs.find((j: { status: string }) => j.status === 'queued' || j.status === 'running');
  if (running) return json(202, { jobId: running.id });

  // Tier and quota rules (E-18): see decideGeneration. Everything is decided here, never in the app.
  const decision = decideGeneration(ent as never, kind, jobs, month ?? []);
  if (!decision.allow) {
    const error = {
      needs_trial: 'Start your trial to generate plans.',
      upgrade: 'Upgrade to Pro to build your meal plan.',
      quota: "You've used this month's plan generations. They reset next month.",
    }[decision.reason];
    return json(403, { error, reason: decision.reason });
  }

  const { data: job, error: jobErr } = await admin
    .from('generation_jobs')
    .insert({ user_id: user.id, kind, status: 'queued' })
    .select('id')
    .single();
  if (jobErr || !job) return json(500, { error: 'Could not start the job.' });

  EdgeRuntime.waitUntil(run(admin, user.id, job.id, kind));
  return json(202, { jobId: job.id });
});

async function run(admin: ReturnType<typeof createClient>, userId: string, jobId: string, kind: PlanKind) {
  const fail = (error: string) =>
    admin.from('generation_jobs').update({ status: 'failed', error, finished_at: new Date().toISOString() }).eq('id', jobId);
  try {
    await admin.from('generation_jobs').update({ status: 'running' }).eq('id', jobId);

    const profile = getModelProfile(Deno.env.get('MODEL_PROFILE'));
    const cfg = {
      profile,
      apiKey: Deno.env.get('OPENROUTER_API_KEY') ?? 'proxy-injected',
      // Metadata only: never prompts or model output.
      log: async (l: AiCallLog) => {
        await admin.from('ai_call_logs').insert(aiCallRow(l));
      },
    };

    const { data: row } = await admin.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (!row) return await fail('Profile is incomplete.');

    // Guardrails first: limit, classify (rules, then the light model), sanitise, log.
    const call = (c: Parameters<typeof callStructured>[1]) => callStructured(cfg, c);
    const guard = await runGuardrails({ call: call as never, fields: extractFreeText(row.onboarding), userId, jobId });
    if (guard.events.length > 0) {
      // Text is kept only for the review queue and purged after the retention window (see guardrailRow).
      await admin.from('guardrail_events').insert(guard.events.map((e) => guardrailRow(userId, jobId, e)));
    }
    const inputs = buildPlanInputs(row, new Date(), { conservative: guard.conservative, extraFlags: guard.riskFlags });

    // Candidates are pre-filtered in SQL by equipment, contraindications and allergens.
    const { data: candidates, error: cErr } =
      kind === 'workout_plan'
        ? await admin.rpc('candidate_exercises', {
            p_equipment: expandEquipment(inputs.equipment),
            p_contraindications: inputs.contraindications,
            p_level: inputs.level,
          })
        : await admin.rpc('candidate_recipes', { p_allergens: inputs.allergens, p_diet: inputs.diet });
    if (cErr || !candidates?.length) return await fail('No suitable options found.');

    const { data: facts } = await admin
      .from('memory_facts')
      .select('fact')
      .eq('user_id', userId)
      .eq('obsolete', false)
      .order('created_at', { ascending: false })
      .limit(20);
    // Swap signal: exercises the user keeps swapping out (catalog names only, never free text).
    const { data: swaps } = await admin.from('plan_swaps').select('from_slug').eq('user_id', userId);
    const swapped = swapSignals(swaps ?? []);
    const swapLines = swapped.length ? [`- The user often swaps out these exercises (avoid them): ${swapped.join(', ')}`] : [];
    const memorySummary = [...(facts ?? []).map((f: { fact: string }) => `- ${f.fact}`), ...swapLines].join('\n');

    const result = await runPipeline({
      kind, userId, jobId, inputs, userText: { notes: guard.notes, memory: memorySummary },
      library: candidates, // already filtered in SQL; the validator re-checks every item
      canEscalate: profile.escalation !== null,
      call: (c) => callStructured(cfg, c),
    });
    // Plan + QA scores + attempt log live in generation_jobs.result.
    await admin
      .from('generation_jobs')
      .update({
        status: 'done',
        // Disclaimer + professional suggestion travel with the plan when a red flag was seen.
        result: { ...result, guardrails: { conservative: guard.conservative, disclaimer: guard.disclaimer } },
        needs_review: result.needsReview || guard.conservative,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (e) {
    // Keep errors generic: they can echo model output.
    await fail(e instanceof PlanInputError ? 'Profile is incomplete.' : 'Generation failed. Try again.');
  }
}
