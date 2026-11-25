import type { PlanKind } from '../ai/schemas.ts';

// Pure helpers for the "building your plan" screen. They only look at generation_jobs rows.

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobRow {
  id: string;
  kind: PlanKind;
  status: JobStatus;
  created_at: string;
  result?: unknown;
  error?: string | null;
}

/** Longest we wait before showing the retry state. Free dev models can be slow; paid ones take seconds. */
export const GENERATION_TIMEOUT_MS = 150_000;
export const POLL_INTERVAL_MS = 2_000;

export type GenerationStepId = 'calories' | 'exercises' | 'meals';
export type GenerationStepState = 'pending' | 'active' | 'done';
export type Phase = 'running' | 'done' | 'failed' | 'timeout';

export interface GenerationProgress {
  phase: Phase;
  steps: { id: GenerationStepId; state: GenerationStepState }[];
}

/** The most recent job of each kind. */
export function latestJobs(rows: readonly JobRow[]): Partial<Record<PlanKind, JobRow>> {
  const out: Partial<Record<PlanKind, JobRow>> = {};
  for (const r of rows) {
    const cur = out[r.kind];
    if (!cur || r.created_at > cur.created_at) out[r.kind] = r;
  }
  return out;
}

const stateOf = (j: JobRow | undefined): GenerationStepState => (!j ? 'pending' : j.status === 'done' ? 'done' : 'active');

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
    { id: 'exercises', state: stateOf(w) },
    { id: 'meals', state: stateOf(n) },
  ];
  let phase: Phase = 'running';
  if (w?.status === 'failed' || n?.status === 'failed') phase = 'failed';
  else if (w?.status === 'done' && n?.status === 'done') phase = 'done';
  else if (nowMs - startedAtMs > GENERATION_TIMEOUT_MS) phase = 'timeout';
  return { phase, steps };
}

/** A job we can wait on instead of starting a new one. */
export const isInFlight = (j: JobRow | undefined): boolean => j?.status === 'queued' || j?.status === 'running';
