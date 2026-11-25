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
  expandEquipment,
  runPipeline,
  getModelProfile,
  type PlanKind,
} from '../../../packages/shared/src/ai/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

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

  // Access is always checked server-side.
  const { data: ent } = await admin.from('entitlements').select('tier,status').eq('user_id', user.id).maybeSingle();
  if (!ent || ent.tier === 'none' || !['active', 'trialing'].includes(ent.status)) {
    return json(403, { error: 'Start your trial to generate plans.' });
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
        await admin.from('ai_call_logs').insert({
          user_id: l.userId, job_id: l.jobId, role: l.role, model: l.model,
          tokens_in: l.tokensIn, tokens_out: l.tokensOut, cost_usd: l.costUsd, latency_ms: l.latencyMs, status: l.status,
        });
      },
    };

    const { data: row } = await admin.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (!row) return await fail('Profile is incomplete.');

    // Guardrails first: limit, classify (rules, then the light model), sanitise, log.
    const call = (c: Parameters<typeof callStructured>[1]) => callStructured(cfg, c);
    const guard = await runGuardrails({ call: call as never, fields: extractFreeText(row.onboarding), userId, jobId });
    if (guard.events.length > 0) {
      await admin.from('guardrail_events').insert(
        guard.events.map((e) => ({ user_id: userId, job_id: jobId, field: e.field, rule: e.rule, action: e.action, input_text: e.inputText })),
      );
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
    const memorySummary = (facts ?? []).map((f: { fact: string }) => `- ${f.fact}`).join('\n');

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
