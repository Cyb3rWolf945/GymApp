import { describe, expect, it } from 'vitest';
import { ACCESS_REDIRECT, decideAccess } from './access';
import { AUDIT_ACTIONS, auditRow } from './audit';
import { NAV } from './nav';

const base = { signedIn: true, isAdmin: true, aal: 'aal2' as const, hasTotpFactor: true };

describe('decideAccess', () => {
  it('lets in an admin who verified TOTP in this session', () => {
    expect(decideAccess(base)).toBe('ok');
  });
  it('sends signed-out visitors to login', () => {
    expect(decideAccess({ ...base, signedIn: false })).toBe('login');
  });
  it('turns non-admins away before any 2FA step, whatever their assurance level', () => {
    expect(decideAccess({ ...base, isAdmin: false })).toBe('forbidden');
    expect(decideAccess({ ...base, isAdmin: false, aal: 'aal1', hasTotpFactor: false })).toBe('forbidden');
  });
  it('requires 2FA: enrol first, then verify for this session', () => {
    expect(decideAccess({ ...base, aal: 'aal1', hasTotpFactor: false })).toBe('mfa_enroll');
    expect(decideAccess({ ...base, aal: 'aal1' })).toBe('mfa_verify');
    expect(decideAccess({ ...base, aal: null })).toBe('mfa_verify');
  });
  it('has a redirect for every non-ok decision', () => {
    expect(Object.keys(ACCESS_REDIRECT).sort()).toEqual(['forbidden', 'login', 'mfa_enroll', 'mfa_verify']);
  });
});

describe('auditRow', () => {
  it('maps an entry to a row and fills optional fields with null', () => {
    expect(auditRow({ adminId: 'a1', action: 'view_user_health', target: 'user:u1', details: { sections: 2 } })).toEqual({
      admin_id: 'a1', action: 'view_user_health', target: 'user:u1', details: { sections: 2 },
    });
    expect(auditRow({ adminId: 'a1', action: 'admin_login' })).toEqual({ admin_id: 'a1', action: 'admin_login', target: null, details: null });
  });
  it('knows the actions the pages use', () => {
    expect(AUDIT_ACTIONS).toContain('view_user_health');
  });
});

describe('sidebar', () => {
  it('lists the sections from the issue, in order', () => {
    expect(NAV.map((n) => n.label)).toEqual(['Overview', 'P&L', 'Funnel', 'AI health', 'Guardrails', 'Users', 'Ads', 'Engagement', 'Content']);
    expect(new Set(NAV.map((n) => n.href)).size).toBe(NAV.length);
  });
});
