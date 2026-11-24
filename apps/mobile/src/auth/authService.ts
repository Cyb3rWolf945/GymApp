import type { SupabaseClient } from '@supabase/supabase-js';
import { authCopy } from './copy';

export type AuthResult = { ok: true } | { ok: false; error: string };
export type OAuthProvider = 'google' | 'apple';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Send a magic link. `redirectTo` is the URL the link opens (web origin or app deep link). */
export async function signInWithMagicLink(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<AuthResult> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) return { ok: false, error: authCopy.invalidEmail };
  const { error } = await client.auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: redirectTo },
  });
  return error ? { ok: false, error: authCopy.genericError } : { ok: true };
}

/** Web / Android OAuth. On web the browser redirects; on native we open the URL and exchange the code. */
export async function signInWithOAuth(
  client: SupabaseClient,
  provider: OAuthProvider,
  redirectTo: string,
  openAuthSession?: (url: string, redirectTo: string) => Promise<string | null>,
): Promise<AuthResult> {
  const native = Boolean(openAuthSession);
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: native },
  });
  if (error) return { ok: false, error: authCopy.genericError };
  if (!native || !data?.url) return { ok: true };
  const resultUrl = await openAuthSession!(data.url, redirectTo);
  if (!resultUrl) return { ok: false, error: authCopy.genericError };
  const code = new URL(resultUrl).searchParams.get('code');
  if (!code) return { ok: false, error: authCopy.genericError };
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  return exchangeError ? { ok: false, error: authCopy.genericError } : { ok: true };
}

/** Native iOS: Sign in with Apple identity token -> Supabase session. */
export async function signInWithAppleToken(
  client: SupabaseClient,
  identityToken: string | null | undefined,
): Promise<AuthResult> {
  if (!identityToken) return { ok: false, error: authCopy.genericError };
  const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
  return error ? { ok: false, error: authCopy.genericError } : { ok: true };
}

/** Belt and braces: the DB trigger creates the row; this covers users created before it existed. */
export async function ensureProfile(client: SupabaseClient, userId: string): Promise<void> {
  await client
    .from('profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
}

export async function signOut(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signOut();
  return error ? { ok: false, error: authCopy.genericError } : { ok: true };
}
