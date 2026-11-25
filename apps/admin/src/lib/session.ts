import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { ACCESS_REDIRECT, type AccessFacts, decideAccess } from './access';
import { type AuditEntry, auditRow } from './audit';
import { createAdminClient } from './supabase/admin';
import { createClient } from './supabase/server';

/** Facts about the current visitor, checked against the auth server (`getUser`), not just the cookie. */
const loadFacts = cache(async (): Promise<AccessFacts & { userId: string | null; email: string | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { signedIn: false, isAdmin: false, aal: null, hasTotpFactor: false, userId: null, email: null };

  const { data: row } = await createAdminClient().from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  const isAdmin = !!row;
  if (!isAdmin) return { signedIn: true, isAdmin, aal: null, hasTotpFactor: false, userId: user.id, email: user.email ?? null };

  const [{ data: aal }, { data: factors }] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
  return {
    signedIn: true,
    isAdmin,
    aal: aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : null,
    hasTotpFactor: (factors?.totp ?? []).some((f) => f.status === 'verified'),
    userId: user.id,
    email: user.email ?? null,
  };
});

/**
 * The gate for every admin page, server action and route handler. Redirects unless the visitor is an admin who
 * verified a TOTP code in this session. Returns who the admin is.
 */
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const facts = await loadFacts();
  const decision = decideAccess(facts);
  if (decision !== 'ok') redirect(ACCESS_REDIRECT[decision]);
  return { id: facts.userId!, email: facts.email };
}

/** For the 2FA pages: the visitor must be a signed-in admin, but not yet through 2FA. */
export async function requireAdminForMfa(): Promise<{ id: string }> {
  const facts = await loadFacts();
  if (!facts.signedIn) redirect(ACCESS_REDIRECT.login);
  if (!facts.isAdmin) redirect(ACCESS_REDIRECT.forbidden);
  return { id: facts.userId! };
}

export async function audit(entry: AuditEntry): Promise<void> {
  const { error } = await createAdminClient().from('admin_audit_log').insert(auditRow(entry));
  // Fail closed: no audit row, no access to health data.
  if (error) throw new Error('Could not write the audit log.');
}
