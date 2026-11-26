import { GENERATION_BUDGET_MS, MIN_ATTEMPT_MS } from './pipeline.ts';

// The time budget of one plan run, in one place so the numbers can be checked together.
//
//   run start ──[ wait for the workout job, nutrition only: at most SIBLING_WAIT_MS ]──[ work: the rest of the budget ]
//   0                                                   30 s                        GENERATION_BUDGET_MS = 100 s
//                                                                         HARD_LIMIT_MS = 110 s: the job is failed here
//                                                                         WALL_CLOCK_LIMIT_MS = 120 s: the runtime kills the function
//
// The wait and the work share ONE clock that starts when the run starts, so a run can never outlive the hard limit.

/** The Edge Function's wall-clock limit (about 120 s). Past it the function is killed and cannot mark the job failed. */
export const WALL_CLOCK_LIMIT_MS = 120_000;
/** The whole run (wait + work) is cut off here, under the wall-clock limit, and the job is marked failed. */
export const HARD_LIMIT_MS = 110_000;
/** The longest the nutrition job waits for the workout job before starting its own work. */
export const SIBLING_WAIT_MS = 30_000;

/** Time left of the run's budget, `runStartedAt` being when the run started (not when the work did). */
export const budgetLeftMs = (runStartedAt: number, now: number): number => Math.max(0, GENERATION_BUDGET_MS - (now - runStartedAt));

/** How long the nutrition job may still wait: never so long that not even one model attempt would fit afterwards. */
export const siblingWaitMs = (runStartedAt: number, now: number): number => Math.max(0, Math.min(SIBLING_WAIT_MS, budgetLeftMs(runStartedAt, now) - MIN_ATTEMPT_MS));
