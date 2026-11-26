import type { PlanKind } from '../ai/schemas.ts';
import { STALE_JOB_MS } from '../ai/sweep.ts';

// Pure helpers for the "building your plan" screen. They only look at generation_jobs rows.

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobRow {
  id: string;
  kind: PlanKind;
  status: JobStatus;
  created_at: string;
  result?: unknown;
  error?: string | null;
  /** Weekly adaptation (E-54): `reverted` jobs are not the current plan. */
  adapt_state?: 'new' | 'kept' | 'reverted' | null;
  adapt_week?: string | null;
}

/** Longest we wait before showing the retry state (3 minutes). The server ends every job well before that, so this is the last resort. */
export const GENERATION_TIMEOUT_MS = 180_000;
export const POLL_INTERVAL_MS = 2_000;
/** Poll gaps: 2 s, then 3 s, then 5 s for as long as it takes (the screen is waiting on a model, not on a quick query). */
export const POLL_BACKOFF_MS = [2_000, 3_000, 5_000] as const;
/** The wait before poll number `n` (0 = the first one after starting). */
export const pollDelayMs = (n: number): number => POLL_BACKOFF_MS[Math.min(Math.max(0, Math.floor(n)), POLL_BACKOFF_MS.length - 1)];

/** True once the 3-minute wait for this attempt has run out. `startedAtMs` is when the attempt started and never moves. */
export const generationTimedOut = (startedAtMs: number, nowMs: number): boolean => nowMs - startedAtMs > GENERATION_TIMEOUT_MS;

/** A queued or running job older than `STALE_JOB_MS` is dead (its function was killed): the server treats it as failed, so does the app. */
export const isStaleJob = (j: Pick<JobRow, 'status' | 'created_at'> | undefined, nowMs: number): boolean =>
  (j?.status === 'queued' || j?.status === 'running') && nowMs - Date.parse(j.created_at) > STALE_JOB_MS;

/** The status to act on: a stale job reads as failed. */
export const effectiveStatus = (j: JobRow | undefined, nowMs: number): JobStatus | undefined => (!j ? undefined : isStaleJob(j, nowMs) ? 'failed' : j.status);

export type GenerationStepId = 'calories' | 'exercises' | 'meals';
export type GenerationStepState = 'pending' | 'active' | 'done';
export type Phase = 'running' | 'done' | 'failed' | 'timeout';

export interface GenerationProgress {
  phase: Phase;
  steps: { id: GenerationStepId; state: GenerationStepState }[];
}

/** The most recent job of each kind. A weekly plan the user went back from does not count. */
export function latestJobs(rows: readonly JobRow[]): Partial<Record<PlanKind, JobRow>> {
  const out: Partial<Record<PlanKind, JobRow>> = {};
  for (const r of rows) {
    if (r.adapt_state === 'reverted') continue;
    const cur = out[r.kind];
    if (!cur || r.created_at > cur.created_at) out[r.kind] = r;
  }
  return out;
}

const stateOf = (j: JobRow | undefined, nowMs: number): GenerationStepState => (!j ? 'pending' : effectiveStatus(j, nowMs) === 'done' ? 'done' : 'active');

/**
 * Steps are real: "Calculating your calories" is the local calc (done as soon as we start),
 * "Picking your exercises" follows the workout job, "Planning your meals" the nutrition job.
 */
export function deriveProgress(rows: readonly JobRow[], startedAtMs: number, nowMs: number): GenerationProgress {
  const jobs = latestJobs(rows);
  const w = jobs.workout_plan;
  const n = jobs.nutrition_plan;
  const steps: GenerationProgress['steps'] = [
    { id: 'calories', state: 'done' },
    { id: 'exercises', state: stateOf(w, nowMs) },
    { id: 'meals', state: stateOf(n, nowMs) },
  ];
  let phase: Phase = 'running';
  const ws = effectiveStatus(w, nowMs);
  const ns = effectiveStatus(n, nowMs);
  if (ws === 'failed' || ns === 'failed') phase = 'failed';
  else if (ws === 'done' && ns === 'done') phase = 'done';
  else if (generationTimedOut(startedAtMs, nowMs)) phase = 'timeout';
  return { phase, steps };
}

/** A job we can wait on instead of starting a new one: alive, not stale. */
export const isInFlight = (j: JobRow | undefined, nowMs: number = Date.now()): boolean => (j?.status === 'queued' || j?.status === 'running') && !isStaleJob(j, nowMs);
