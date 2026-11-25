import { describe, expect, it } from 'vitest';
import { adaptEligibility, adaptWeek, type AdaptCandidate } from './weeklyAdapt';
import { latestJobs, type JobRow } from './progress';

const now = new Date('2026-11-25T06:00:00Z'); // Wednesday
const ent = (tier: 'basic' | 'pro' | 'elite', over: Record<string, unknown> = {}) =>
  ({ tier, status: 'active', current_period_end: '2026-12-20T00:00:00Z', past_due_since: null, ...over }) as AdaptCandidate['ent'];
const base: AdaptCandidate = { ent: ent('elite'), enabled: true, jobsThisMonth: 2, ranThisWeek: false };

describe('adaptWeek', () => {
  it('is the Monday (UTC) of the week', () => {
    expect(adaptWeek(new Date('2026-11-23T00:00:00Z'))).toBe('2026-11-23');
    expect(adaptWeek(now)).toBe('2026-11-23');
    expect(adaptWeek(new Date('2026-11-29T23:59:00Z'))).toBe('2026-11-23');
    expect(adaptWeek(new Date('2026-11-30T00:00:00Z'))).toBe('2026-11-30');
  });
});

describe('adaptEligibility', () => {
  it('runs for an active Elite user who has not opted out, has quota and has not run this week', () => {
    expect(adaptEligibility(base, now)).toEqual({ run: true });
  });
  it('needs an active entitlement that includes weekly adjustments', () => {
    expect(adaptEligibility({ ...base, ent: null }, now)).toEqual({ run: false, reason: 'no_access' });
    expect(adaptEligibility({ ...base, ent: ent('pro') }, now)).toEqual({ run: false, reason: 'no_access' });
    expect(adaptEligibility({ ...base, ent: ent('elite', { status: 'canceled' }) }, now)).toEqual({ run: false, reason: 'no_access' });
    expect(adaptEligibility({ ...base, ent: ent('elite', { current_period_end: '2026-11-01T00:00:00Z' }) }, now)).toEqual({ run: false, reason: 'no_access' });
  });
  it('respects the opt-out', () => {
    expect(adaptEligibility({ ...base, enabled: false }, now)).toEqual({ run: false, reason: 'opted_out' });
  });
  it('is idempotent per week', () => {
    expect(adaptEligibility({ ...base, ranThisWeek: true }, now)).toEqual({ run: false, reason: 'already_ran' });
  });
  it('needs room in the monthly quota for both plans', () => {
    expect(adaptEligibility({ ...base, jobsThisMonth: 58 }, now)).toEqual({ run: true });
    expect(adaptEligibility({ ...base, jobsThisMonth: 59 }, now)).toEqual({ run: false, reason: 'quota' });
  });
});

describe('latestJobs after "Go back to last week"', () => {
  const job = (id: string, created_at: string, adapt_state?: JobRow['adapt_state']): JobRow => ({ id, kind: 'workout_plan', status: 'done', created_at, adapt_state });
  it('skips a reverted weekly plan, keeps a kept or new one', () => {
    const rows = [job('old', '2026-11-16T00:00:00Z'), job('weekly', '2026-11-23T06:00:00Z', 'reverted')];
    expect(latestJobs(rows).workout_plan?.id).toBe('old');
    expect(latestJobs([rows[0], job('weekly', '2026-11-23T06:00:00Z', 'new')]).workout_plan?.id).toBe('weekly');
    expect(latestJobs([rows[0], job('weekly', '2026-11-23T06:00:00Z', 'kept')]).workout_plan?.id).toBe('weekly');
  });
});
