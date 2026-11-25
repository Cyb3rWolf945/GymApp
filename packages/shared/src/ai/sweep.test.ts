import { describe, expect, it, vi } from 'vitest';
import { STALE_JOB_ERROR, STALE_JOB_MS, type SweepDb, staleCutoff, sweepStaleJobs } from './sweep';

function fakeDb(error: unknown = null) {
  const lt = vi.fn().mockResolvedValue({ error });
  const inFn = vi.fn(() => ({ lt }));
  const update = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ update }));
  return { db: { from } as unknown as SweepDb, from, update, inFn, lt };
}

const NOW = Date.parse('2026-11-25T22:30:00.000Z');

describe('stale job sweep', () => {
  it('a job is stale after 5 minutes', () => {
    expect(STALE_JOB_MS).toBe(5 * 60 * 1000);
    expect(staleCutoff(NOW)).toBe('2026-11-25T22:25:00.000Z');
  });
  it('marks queued and running jobs older than the cutoff as failed with a plain message, and nothing else', async () => {
    const { db, from, update, inFn, lt } = fakeDb();
    expect(await sweepStaleJobs(db, NOW)).toBe(true);
    expect(from).toHaveBeenCalledWith('generation_jobs');
    expect(update).toHaveBeenCalledWith({ status: 'failed', error: STALE_JOB_ERROR, finished_at: '2026-11-25T22:30:00.000Z' });
    expect(inFn).toHaveBeenCalledWith('status', ['queued', 'running']); // never done or already failed jobs
    expect(lt).toHaveBeenCalledWith('created_at', '2026-11-25T22:25:00.000Z');
  });
  it('says so when the update failed, and never throws', async () => {
    const { db } = fakeDb({ message: 'down' });
    expect(await sweepStaleJobs(db, NOW)).toBe(false);
  });
  it('the message is plain and short', () => {
    expect(STALE_JOB_ERROR).toBe('Took too long. Try again.');
  });
});
