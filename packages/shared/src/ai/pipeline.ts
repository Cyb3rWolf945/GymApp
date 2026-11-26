import { AiCallError } from './openrouter.ts';
import type { CallFn } from './generate.ts';
import { type ExerciseCandidate, type PlanInputs, type RecipeCandidate, SYSTEM_PROMPTS, type UserText, buildUserMessage } from './prompts.ts';
import { type QaVerdict, qaFeedback, runQa, verdictPasses } from './qa.ts';
import { type MealTemplateResult, type TemplateContext, buildNutritionTemplate } from './mealTemplate.ts';
import { workoutTemplate } from './templates.ts';
import { type NutritionPlan, PLAN_SCHEMAS, type PlanKind, type WorkoutPlan } from './schemas.ts';
import { validateNutrition, validateWorkout } from './validator.ts';

/** Planner retries after the first failed attempt (the default; a model profile can lower it). */
export const MAX_RETRIES = 2;
/** The whole generation must finish well inside the Edge Function's wall-clock limit (about 120 s). */
export const GENERATION_BUDGET_MS = 100_000;
/** Do not start another model attempt with less than this left: it could not finish. */
export const MIN_ATTEMPT_MS = 20_000;

export type AttemptOutcome = 'passed' | 'invalid_output' | 'http_error' | 'validation_failed' | 'qa_failed' | 'budget_exceeded';

export interface AttemptRecord {
  stage: 'planner' | 'escalation';
  outcome: AttemptOutcome;
  /** Validator errors or QA feedback (ours, not raw model text for schema failures). */
  errors: string[];
  qaScores?: Record<string, number>;
}

export interface PipelineResult {
  plan: WorkoutPlan | NutritionPlan;
  /** null when the template was used or the QA call itself failed. */
  qa: QaVerdict | null;
  source: 'planner' | 'escalation' | 'template';
  attempts: AttemptRecord[];
  /** True when a human should look at this plan (template used, or QA was unavailable). */
  needsReview: boolean;
  /** Template meal plan only: the soft filters (cooking time, budget, earlier swaps, dislikes) that had to be relaxed. */
  relaxed?: string[];
}

export interface PipelineArgs {
  kind: PlanKind;
  userId: string;
  jobId: string;
  inputs: PlanInputs;
  /** Candidates already filtered in SQL; also the library the validator checks against. */
  library: ExerciseCandidate[] | RecipeCandidate[];
  /** Guardrail-cleared notes and retrieved memory. */
  userText: UserText;
  call: CallFn;
  /** True when the model profile has an escalation model (prod only). */
  canEscalate: boolean;
  /** Planner retries after the first attempt. Default `MAX_RETRIES`. */
  maxRetries?: number;
  /** `skip`: no QA call, the validator alone accepts a plan (dev profile). Default `enforce`. */
  qa?: 'enforce' | 'skip';
  /** Soft signals for the template meal plan (seed, earlier swaps, memory facts). */
  templateContext?: TemplateContext;
  /** Epoch ms by which everything must be over. When too little is left the pipeline stops and returns the template. */
  deadlineAt?: number;
  /** Clock, for tests. */
  now?: () => number;
}

/**
 * planner → validator → QA. On failure feed the errors back (max 2 retries), then one attempt
 * on the escalation model (prod only), then a safe template flagged for review. Out of time (`deadlineAt`) also ends
 * in the template: a job must always finish, never hang.
 */
export async function runPipeline(args: PipelineArgs): Promise<PipelineResult> {
  const { kind, inputs } = args;
  const { name, schema } = PLAN_SCHEMAS[kind];
  const attempts: AttemptRecord[] = [];
  let feedback = '';
  const now = args.now ?? Date.now;
  const outOfTime = () => args.deadlineAt !== undefined && args.deadlineAt - now() < MIN_ATTEMPT_MS;

  const validate = (plan: WorkoutPlan | NutritionPlan) =>
    kind === 'workout_plan'
      ? validateWorkout(plan as WorkoutPlan, inputs, args.library as ExerciseCandidate[])
      : validateNutrition(plan as NutritionPlan, inputs, args.library as RecipeCandidate[]);

  const attempt = async (stage: 'planner' | 'escalation', retry: number): Promise<PipelineResult | null> => {
    if (outOfTime()) {
      attempts.push({ stage, outcome: 'budget_exceeded', errors: [] });
      return null;
    }
    let plan: WorkoutPlan | NutritionPlan;
    try {
      plan = await args.call({
        role: 'planner',
        schemaName: name,
        schema: schema as never,
        system: SYSTEM_PROMPTS[kind],
        user: buildUserMessage(kind, inputs, args.library, args.userText, feedback),
        userId: args.userId,
        jobId: args.jobId,
        escalate: stage === 'escalation',
        retry,
      }) as WorkoutPlan | NutritionPlan;
    } catch (e) {
      if (!(e instanceof AiCallError)) throw e;
      const outcome = e.code === 'INVALID_OUTPUT' ? 'invalid_output' : 'http_error';
      attempts.push({ stage, outcome, errors: [] });
      if (outcome === 'invalid_output') feedback = 'Your previous reply did not match the JSON schema. Follow it exactly.';
      return null;
    }

    const errors = validate(plan);
    if (errors.length > 0) {
      const shown = errors.slice(0, 10);
      attempts.push({ stage, outcome: 'validation_failed', errors: shown });
      feedback = shown.join('\n');
      return null;
    }

    // Free models: QA fails every time and doubles the wall time, so the validator alone accepts the plan.
    if (args.qa === 'skip') {
      attempts.push({ stage, outcome: 'passed', errors: ['QA skipped'] });
      return { plan, qa: null, source: stage, attempts, needsReview: false };
    }
    if (outOfTime()) {
      // The checks passed but there is no time for QA: keep the plan and ask a human to look.
      attempts.push({ stage, outcome: 'passed', errors: ['QA skipped: out of time'] });
      return { plan, qa: null, source: stage, attempts, needsReview: true };
    }
    let qa: QaVerdict;
    try {
      qa = await runQa({ call: args.call, kind, plan, inputs, notes: args.userText.notes, userId: args.userId, jobId: args.jobId, retry });
    } catch (e) {
      if (!(e instanceof AiCallError)) throw e;
      // The deterministic checks passed; keep the plan but ask a human to look.
      attempts.push({ stage, outcome: 'passed', errors: ['QA unavailable'] });
      return { plan, qa: null, source: stage, attempts, needsReview: true };
    }
    const qaScores = Object.fromEntries(qa.criteria.map((c) => [c.criterion, c.score]));
    if (!verdictPasses(qa)) {
      attempts.push({ stage, outcome: 'qa_failed', errors: [qaFeedback(qa)], qaScores });
      feedback = qaFeedback(qa);
      return null;
    }
    attempts.push({ stage, outcome: 'passed', errors: [], qaScores });
    return { plan, qa, source: stage, attempts, needsReview: false };
  };

  const maxRetries = args.maxRetries ?? MAX_RETRIES;
  for (let i = 0; i <= maxRetries; i++) {
    const done = await attempt('planner', i);
    if (done) return done;
    if (outOfTime()) break;
  }
  if (args.canEscalate && !outOfTime()) {
    const done = await attempt('escalation', maxRetries + 1);
    if (done) return done;
  }

  if (kind === 'workout_plan') return { plan: workoutTemplate(inputs, args.library as ExerciseCandidate[]), qa: null, source: 'template', attempts, needsReview: true };
  const meals: MealTemplateResult = buildNutritionTemplate(inputs, args.library as RecipeCandidate[], args.templateContext);
  return { plan: meals.plan, qa: null, source: 'template', attempts, needsReview: true, relaxed: meals.relaxed };
}
