// Jobs that never finish (the Edge Function was killed at its wall-clock limit) must not stay `running` forever.

/**
 * A job still queued or running after this long is dead. A run ends by itself in under 110 s (plus up to 60 s of waiting
 * for the workout plan, for the nutrition job), so 3 minutes is safely past anything alive. The app, the sweep and
 * generate-plan all use this one limit.
 */
export const STALE_JOB_MS = 3 * 60 * 1000;
export const STALE_JOB_ERROR = 'Took too long. Try again.';

/** The part of the Supabase client the sweep uses, so it can be tested with a stand-in. */
export interface SweepDb {
  from(table: 'generation_jobs'): {
    update(values: Record<string, unknown>): {
      in(column: 'status', values: string[]): {
        lt(column: 'created_at', value: string): PromiseLike<{ error: unknown }>;
      };
    };
  };
}

/** Creation time before which a queued or running job counts as stale. */
export const staleCutoff = (nowMs: number): string => new Date(nowMs - STALE_JOB_MS).toISOString();

/** Marks every job that has been queued or running for over `STALE_JOB_MS` as failed. Returns whether the update went through. */
export async function sweepStaleJobs(db: SweepDb, nowMs = Date.now()): Promise<boolean> {
  const { error } = await db
    .from('generation_jobs')
    .update({ status: 'failed', error: STALE_JOB_ERROR, finished_at: new Date(nowMs).toISOString() })
    .in('status', ['queued', 'running'])
    .lt('created_at', staleCutoff(nowMs));
  return !error;
}
