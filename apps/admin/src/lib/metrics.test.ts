import { describe, expect, it } from 'vitest';
import { daysAgo, funnelSteps, pct, sum, usd } from './metrics';

describe('funnelSteps', () => {
  it('sums visitors per step and computes conversion from the previous step', () => {
    const steps = funnelSteps([
      { name: 'quiz_start', visitors: 60 }, { name: 'quiz_start', visitors: 40 },
      { name: 'quiz_complete', visitors: 50 }, { name: 'signup', visitors: 25 },
    ]);
    expect(steps[0]).toEqual({ name: 'quiz_start', visitors: 100, conversion: null });
    expect(steps[1]).toMatchObject({ name: 'quiz_complete', visitors: 50, conversion: 0.5 });
    expect(steps[2]).toMatchObject({ name: 'signup', visitors: 25, conversion: 0.5 });
  });
  it('shows zero (not NaN) after an empty step and covers every step in order', () => {
    const steps = funnelSteps([{ name: 'purchase', visitors: 3 }]);
    expect(steps.map((s) => s.name)[0]).toBe('quiz_start');
    expect(steps.at(-1)).toMatchObject({ name: 'purchase', visitors: 3, conversion: 0 });
  });
});

describe('formatting', () => {
  it('formats money, percentages and sums', () => {
    expect(usd(1234.5)).toBe('$1,234.50');
    expect(pct(0.256)).toBe('26%');
    expect(pct(null)).toBe('–');
    expect(sum([1, 2, 3])).toBe(6);
  });
  it('computes day filters in UTC', () => {
    expect(daysAgo(7, new Date('2026-12-10T12:00:00Z'))).toBe('2026-12-03');
  });
});
