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
  formatUserHistory,
  UserHistorySchema,
  getRuntimeModelProfile,
  aiCallRow,
  guardrailRow,
  type PlanKind,
} from '../../../packages/shared/src/ai/index.ts';
import { decideGeneration, startOfMonthUtc } from '../../../packages/shared/src/payments/gating.ts';
import { knownSwapSignals } from '../../../packages/shared/src/plan/swaps.ts';
import { adaptWeek } from '../../../packages/shared/src/plan/weeklyAdapt.ts';
import { buildUpdateSummary } from '../../../packages/shared/src/plan/diff.ts';
import { EXPO_PUSH_URL, EXPO_TOKEN_PATTERN, pushMessage } from '../../../packages/shared/src/notifications/index.ts';
import { originsFromEnv, resolveCaller, withCors } from '../../../packages/shared/src/http/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const STALE_JOB_MS = 5 * 60 * 1000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only

  // Identify the caller: a signed-in user (JWT), or the admin backoffice acting for a user with the service-role key.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const body = await req.json().catch(() => ({}));
  const caller = resolveCaller(token, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), body?.userId);
  if (caller.kind === 'invalid') return json(caller.status, { error: caller.message });
  const adminOverride = caller.kind === 'service';
  let user: { id: string } | null = adminOverride ? { id: caller.userId } : null;
  if (!user) {
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    user = auth.user;
  }
  if (!user) return json(401, { error: 'Sign in to continue.' });

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
  // An admin regenerating a plan for support is not held to the user's tier or quota (the action is audited there).
  // The weekly adaptation (E-54, service key + source 'weekly') is held to the user's tier and quota like any other run.
  const weekly = adminOverride && body?.source === 'weekly';
  const decision = adminOverride && !weekly ? ({ allow: true } as const) : decideGeneration(ent as never, kind, jobs, month ?? []);
  if (!decision.allow) {
    const error = {
      needs_trial: 'Start your trial to generate plans.',
      upgrade: 'Upgrade to Pro to build your meal plan.',
      quota: "You've used this month's plan generations. They reset next month.",
    }[decision.reason];
    return json(403, { error, reason: decision.reason });
  }

  const week = weekly ? adaptWeek(new Date()) : null;
  const { data: job, error: jobErr } = await admin
    .from('generation_jobs')
    .insert({ user_id: user.id, kind, status: 'queued', ...(weekly ? { source: 'weekly', adapt_week: week, adapt_state: 'new' } : {}) })
    .select('id')
    .single();
  // A second weekly run for the same week hits the unique index: nothing to do.
  if (weekly && jobErr?.code === '23505') return json(200, { skipped: 'already_ran' });
  if (jobErr || !job) return json(500, { error: 'Could not start the job.' });

  // "Update my plan": regenerate through the same pipeline and keep a diff against the previous plan.
  const update = body?.update === true || weekly;
  EdgeRuntime.waitUntil(run(admin, user.id, job.id, kind, update, week));
  return json(202, { jobId: job.id });
}, () => originsFromEnv((k) => Deno.env.get(k))));

async function run(admin: ReturnType<typeof createClient>, userId: string, jobId: string, kind: PlanKind, update = false, adaptOfWeek: string | null = null) {
  const fail = (error: string) =>
    admin.from('generation_jobs').update({ status: 'failed', error, finished_at: new Date().toISOString() }).eq('id', jobId);
  try {
    await admin.from('generation_jobs').update({ status: 'running' }).eq('id', jobId);

    const profile = getRuntimeModelProfile(Deno.env.get('MODEL_PROFILE'), Deno.env.get('APP_ENV'));
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

    // Swap signal: exercises the user keeps swapping out (catalog names only, never free text).
    const { data: swaps } = await admin.from('plan_swaps').select('from_slug').eq('user_id', userId);
    const { data: known } = swaps?.length
      ? await admin.from('exercises').select('slug').in('slug', [...new Set(swaps.map((x: { from_slug: string }) => x.from_slug))])
      : { data: [] };
    // Only slugs that exist in the catalog may reach the prompt.
    const swapped = knownSwapSignals(swaps ?? [], new Set((known ?? []).map((k: { slug: string }) => k.slug)));
    const swapLines = swapped.length ? [`- The user often swaps out these exercises (avoid them): ${swapped.join(', ')}`] : [];

    // Last 4 weeks, built in SQL: adherence, e1RM and weight trends, swaps and the active facts.
    // The facts live in the history block, so <memory> only carries the swap signal.
    const { data: historyRaw } = await admin.rpc('user_history', { p_user: userId, p_days: 28 });
    const history = formatUserHistory(historyRaw);
    const memorySummary = swapLines.join('\n');

    const result = await runPipeline({
      kind, userId, jobId, inputs, userText: { notes: guard.notes, memory: memorySummary, history },
      library: candidates, // already filtered in SQL; the validator re-checks every item
      canEscalate: profile.escalation !== null,
      call: (c) => callStructured(cfg, c),
    });

    // "Update my plan": a diff against the previous plan, with one line of why per change.
    let updateSummary: unknown = null;
    if (update) {
      const { data: prev } = await admin
        .from('generation_jobs')
        .select('id,result')
        .eq('user_id', userId)
        .eq('kind', kind)
        .eq('status', 'done')
        .neq('id', jobId)
        .or('adapt_state.is.null,adapt_state.neq.reverted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev) {
        const slugsOf = (r: unknown) => JSON.stringify(r ?? {}).match(/"(?:exerciseSlug|recipeSlug)":"([a-z0-9-]+)"/g) ?? [];
        const slugs = [...new Set([...slugsOf(prev.result), ...slugsOf(result)].map((m) => m.split(':')[1].replace(/"/g, '')))];
        const [{ data: ex }, { data: rc }] = await Promise.all([
          admin.from('exercises').select('slug,name').in('slug', slugs),
          admin.from('recipes').select('slug,name,diet,kcal,protein_g,carbs_g,fat_g').in('slug', slugs),
        ]);
        updateSummary = await buildUpdateSummary({
          kind,
          previousJobId: prev.id,
          previousResult: prev.result,
          nextResult: result,
          names: {
            exercises: new Map((ex ?? []).map((e: { slug: string; name: string }) => [e.slug, e.name])),
            recipes: new Map((rc ?? []).map((r: { slug: string; name: string }) => [r.slug, r.name])),
          },
          recipes: (rc ?? []).map((r: Record<string, unknown>) => ({ ...r, allergens: [] })) as never,
          historyRaw: UserHistorySchema.safeParse(historyRaw).success ? historyRaw : {},
          historyText: history,
          goal: inputs.goal,
          coachStyle: inputs.coachStyle,
          call: ((c: Parameters<typeof callStructured>[1]) => callStructured(cfg, c)) as never,
          userId,
          jobId,
        });
      }
    }
    // Plan + QA scores + attempt log live in generation_jobs.result.
    await admin
      .from('generation_jobs')
      .update({
        status: 'done',
        // Disclaimer + professional suggestion travel with the plan when a red flag was seen.
        result: { ...result, update: updateSummary, guardrails: { conservative: guard.conservative, disclaimer: guard.disclaimer } },
        needs_review: result.needsReview || guard.conservative,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (adaptOfWeek) await notifyWeekly(admin, userId, adaptOfWeek);
  } catch (e) {
    // Keep errors generic: they can echo model output.
    await fail(e instanceof PlanInputError ? 'Profile is incomplete.' : 'Generation failed. Try again.');
  }
}

// Weekly adaptation: one push when both new plans of the week are ready (best effort, never blocks the plan).
async function notifyWeekly(admin: ReturnType<typeof createClient>, userId: string, week: string) {
  try {
    const { data: done } = await admin.from('generation_jobs').select('kind').eq('user_id', userId).eq('adapt_week', week).eq('status', 'done');
    if (new Set((done ?? []).map((j: { kind: string }) => j.kind)).size < 2) return;
    const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', userId).eq('enabled', true);
    const messages = ((tokens ?? []) as { token: string }[])
      .filter((t) => EXPO_TOKEN_PATTERN.test(t.token))
      .map((t) => pushMessage(t.token, 'Your plan was updated for this week. See what changed.', '/weekly-changes'));
    if (messages.length === 0) return;
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // A failed push never affects the plan.
  }
}
