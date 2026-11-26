import { describe, expect, it } from 'vitest';
import { nextRouteAfterSignIn } from './signIn.ts';

describe('nextRouteAfterSignIn', () => {
  const cases: Array<[boolean, boolean, boolean, string]> = [
    // profileComplete, localAnswersComplete, hasPlan, route
    [false, false, false, 'onboarding'],
    [false, true, false, 'generation'],
    [true, false, false, 'generation'],
    [true, true, false, 'generation'],
    [false, false, true, 'today'],
    [false, true, true, 'today'],
    [true, false, true, 'today'],
    [true, true, true, 'today'],
  ];
  it.each(cases)('profile %s, local %s, plan %s → %s', (profileComplete, localAnswersComplete, hasPlan, route) => {
    expect(nextRouteAfterSignIn({ profileComplete, localAnswersComplete, hasPlan })).toBe(route);
  });
});
