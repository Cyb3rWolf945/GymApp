// Who gets into the backoffice. Pure, so the rules are unit-tested. The server (`requireAdmin`) feeds it the facts.

export type AssuranceLevel = 'aal1' | 'aal2' | null;

export interface AccessFacts {
  /** Signed in (verified with the auth server, not just a cookie). */
  signedIn: boolean;
  /** Has a row in the `admins` table. */
  isAdmin: boolean;
  /** Current session assurance: aal2 = a TOTP code was verified in this session. */
  aal: AssuranceLevel;
  /** Has at least one verified TOTP factor. */
  hasTotpFactor: boolean;
}

export type AccessDecision = 'login' | 'forbidden' | 'mfa_enroll' | 'mfa_verify' | 'ok';

/**
 * Order matters: non-admins learn nothing about 2FA. Admins must have a TOTP factor and must have verified it in
 * this session (aal2) before they see anything.
 */
export function decideAccess(f: AccessFacts): AccessDecision {
  if (!f.signedIn) return 'login';
  if (!f.isAdmin) return 'forbidden';
  if (!f.hasTotpFactor) return 'mfa_enroll';
  if (f.aal !== 'aal2') return 'mfa_verify';
  return 'ok';
}

export const ACCESS_REDIRECT: Record<Exclude<AccessDecision, 'ok'>, string> = {
  login: '/login',
  forbidden: '/forbidden',
  mfa_enroll: '/mfa/enroll',
  mfa_verify: '/mfa/verify',
};
