// Smoke test for the AI pipeline with 3 synthetic profiles (a workout and a meal plan each).
//   dev  (free models):   NODE_USE_ENV_PROXY=1 pnpm tsx scripts/smoke-ai.ts
//   prod (paid models):   MODEL_PROFILE=prod CONFIRM_PROD_SMOKE=yes pnpm tsx scripts/smoke-ai.ts   (production only)
// Options: --profiles=N (first N profiles), --only=workout|nutrition.
// Needs OPENROUTER_API_KEY and SUPABASE_ACCESS_TOKEN (the Supabase Management API reads the real exercise and recipe
// catalogue, the same candidates `generate-plan` uses). Exits 1 unless every plan was made by a model, is valid and passed QA.
import {
  type AiCallLog, type ExerciseCandidate, type RecipeCandidate, SMOKE_PROFILES, type SmokeOutcome,
  buildPlanInputs, callStructured, expandEquipment, getModelProfile, runPipeline, smokeGuard, summarizeSmoke, validateNutrition, validateWorkout, verdictPasses,
} from '../packages/shared/src/ai/index.ts';
import { managementQuery } from '../packages/shared/src/db/apply-remote.ts';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const profileName = process.env.MODEL_PROFILE?.trim() || 'dev';
const blocked = smokeGuard(profileName, process.env);
if (blocked) {
  console.error(blocked);
  process.exit(2);
}
const profile = getModelProfile(profileName);
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN ("proxy-injected" in the agent environment).');
const query = managementQuery(process.env.SUPABASE_PROJECT_REF ?? 'qcmpzjopinnqfmbkpqnp', token);

const lit = (xs: readonly string[]) => `array[${xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(',')}]::text[]`;
const logs: AiCallLog[] = [];
const cfg = { profile, apiKey: process.env.OPENROUTER_API_KEY ?? 'proxy-injected', log: (l: AiCallLog) => void logs.push(l) };

async function main() {
  const profiles = SMOKE_PROFILES.slice(0, Number(arg('profiles') ?? SMOKE_PROFILES.length));
  const kinds = (arg('only') === 'workout' ? ['workout_plan'] : arg('only') === 'nutrition' ? ['nutrition_plan'] : ['workout_plan', 'nutrition_plan']) as ('workout_plan' | 'nutrition_plan')[];
  console.log(`Profile: ${profile.name}. ${profiles.length} synthetic profiles x ${kinds.length} plans.`);
  const outcomes: SmokeOutcome[] = [];

  for (const p of profiles) {
    const inputs = buildPlanInputs(p.row as never, new Date());
    for (const kind of kinds) {
      const started = Date.now();
      const base = { profile: p.name, kind, source: 'template' as const, attempts: 0, qaPassed: false, validationErrors: [] as string[] };
      try {
        const library = (kind === 'workout_plan'
          ? await query(`select * from public.candidate_exercises(${lit(expandEquipment(inputs.equipment))}, ${lit(inputs.contraindications)}, '${inputs.level}')`)
          : await query(`select * from public.candidate_recipes(${lit(inputs.allergens)}, '${inputs.diet}')`)) as ExerciseCandidate[] & RecipeCandidate[];
        const r = await runPipeline({
          kind, userId: 'smoke-test', jobId: 'smoke', inputs, library, userText: { notes: '', memory: '' }, canEscalate: profile.escalation !== null,
          call: (c) => callStructured(cfg, c),
        });
        const errors = kind === 'workout_plan' ? validateWorkout(r.plan as never, inputs, library) : validateNutrition(r.plan as never, inputs, library);
        outcomes.push({ ...base, source: r.source, attempts: r.attempts.length, qaPassed: !!r.qa && verdictPasses(r.qa), validationErrors: errors });
      } catch (e) {
        outcomes.push({ ...base, error: (e as Error).message.slice(0, 120) });
      }
      console.log(`  done ${kind} for "${p.name}" in ${Math.round((Date.now() - started) / 1000)}s`);
    }
  }

  const s = summarizeSmoke(outcomes);
  const cost = logs.reduce((t, l) => t + (l.costUsd ?? 0), 0);
  const models = [...new Set(logs.map((l) => l.model))];
  console.log(`\n${s.lines.join('\n')}\n\n${s.passed}/${s.total} passed. ${logs.length} model calls, $${cost.toFixed(4)}, models: ${models.join(', ') || 'none'}`);
  process.exit(s.ok ? 0 : 1);
}
void main();
