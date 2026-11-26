import { describe, expect, it } from 'vitest';
import { HARD_LIMIT_MS, SIBLING_WAIT_MS, WALL_CLOCK_LIMIT_MS, budgetLeftMs, siblingWaitMs } from './budget';
import { GENERATION_BUDGET_MS, MIN_ATTEMPT_MS } from './pipeline';
import { STALE_JOB_MS } from './sweep';

describe('the time budget of a plan run', () => {
  it('the numbers add up: wait + one attempt fit the budget, the budget fits the hard limit, the hard limit fits the runtime', () => {
    expect(SIBLING_WAIT_MS + MIN_ATTEMPT_MS).toBeLessThanOrEqual(GENERATION_BUDGET_MS);
    expect(GENERATION_BUDGET_MS).toBeLessThan(HARD_LIMIT_MS);
    expect(HARD_LIMIT_MS).toBeLessThan(WALL_CLOCK_LIMIT_MS);
    // A job that is still queued/running after the stale limit is dead for sure: the run always ends before that.
    expect(HARD_LIMIT_MS).toBeLessThan(STALE_JOB_MS);
  });
  it('the wait counts against the same budget as the work', () => {
    const t0 = 1_000_000;
    expect(budgetLeftMs(t0, t0)).toBe(GENERATION_BUDGET_MS);
    expect(budgetLeftMs(t0, t0 + SIBLING_WAIT_MS)).toBe(GENERATION_BUDGET_MS - SIBLING_WAIT_MS);
    expect(budgetLeftMs(t0, t0 + 10 * GENERATION_BUDGET_MS)).toBe(0);
  });
  it('the wait is at most 30 s from the start of the run, and shrinks to what leaves room for one attempt', () => {
    const t0 = 1_000_000;
    expect(siblingWaitMs(t0, t0)).toBe(SIBLING_WAIT_MS);
    // Already 90 s in: only 10 s left, less than one attempt needs, so do not wait at all.
    expect(siblingWaitMs(t0, t0 + 90_000)).toBe(0);
    // 60 s in: 40 s left, 20 s of it for one attempt, so wait at most 20 s.
    expect(siblingWaitMs(t0, t0 + 60_000)).toBe(GENERATION_BUDGET_MS - 60_000 - MIN_ATTEMPT_MS);
    expect(siblingWaitMs(t0, t0 + 10 * GENERATION_BUDGET_MS)).toBe(0);
  });
  it('wait + work never goes past the budget, whatever the wait', () => {
    const t0 = 0;
    for (const waited of [0, 1_000, 15_000, 30_000]) {
      const w = Math.min(waited, siblingWaitMs(t0, t0));
      expect(w + budgetLeftMs(t0, t0 + w)).toBe(GENERATION_BUDGET_MS);
    }
  });
});
