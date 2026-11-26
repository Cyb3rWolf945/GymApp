/** Where a signed-in user goes when they have no plan yet. */
export type PostSignInRoute = 'today' | 'generation' | 'onboarding';

/**
 * Decides from the saved profile, not only from what this device remembers:
 * - a plan exists → Today;
 * - complete answers on this device (they get saved first) or a complete saved profile → build the plan;
 * - otherwise → the quiz, which resumes at the first missing step.
 */
export function nextRouteAfterSignIn(s: { profileComplete: boolean; localAnswersComplete: boolean; hasPlan: boolean }): PostSignInRoute {
  if (s.hasPlan) return 'today';
  if (s.localAnswersComplete || s.profileComplete) return 'generation';
  return 'onboarding';
}
