import type { SupabaseClient } from '@supabase/supabase-js';
import { authCopy } from './copy';
import { type AuthErrorKind, mapAuthError, mapCodeError, mapOAuthError } from './errors';
import { cleanCode, isValidCode, isValidEmail, isValidPassword, normalizeEmail } from './logic';

/** `kind` tells the screen what to offer next (resend the email, switch to Log in, ...). */
export type AuthResult = { ok: true } | { ok: false; error: string; kind?: AuthErrorKind };
export type SignUpResult = { ok: true; needsConfirmation: boolean } | { ok: false; error: string; kind?: AuthErrorKind };
export type OAuthProvider = 'google' | 'apple';

export { isValidEmail };

const failure = (error: Parameters<typeof mapAuthError>[0]) => {
  const m = mapAuthError(error);
  return { ok: false as const, error: m.message, kind: m.kind };
};
/** Failures of Google, Apple and linking: same shape, with the "log in another way" messages. */
const oauthFailure = (error: Parameters<typeof mapOAuthError>[0]) => {
  const m = mapOAuthError(error);
  return { ok: false as const, error: m.message, kind: m.kind };
};
const invalid = (error: string, kind: AuthErrorKind = 'unknown') => ({ ok: false as const, error, kind });

/** Create an account with email + password. Supabase emails a confirmation link that opens `redirectTo`. */
export async function signUpWithPassword(client: SupabaseClient, email: string, password: string, redirectTo: string): Promise<SignUpResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return invalid(authCopy.invalidEmail);
  if (!isValidPassword(password)) return invalid(authCopy.shortPassword, 'weak_password');
  const { data, error } = await client.auth.signUp({ email: clean, password, options: { emailRedirectTo: redirectTo } });
  if (error) return failure(error);
  // With email confirmation on, an address that already has an account comes back without an error and without
  // identities (so nobody can probe which emails exist). Treat it as "already registered".
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return invalid(authCopy.errors.alreadyRegistered, 'already_registered');
  }
  return { ok: true, needsConfirmation: !data.session };
}

export async function signInWithPassword(client: SupabaseClient, email: string, password: string): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return invalid(authCopy.invalidEmail);
  if (!password) return invalid(authCopy.errors.invalidCredentials, 'invalid_credentials');
  const { error } = await client.auth.signInWithPassword({ email: clean, password });
  return error ? failure(error) : { ok: true };
}

/** Send the confirmation email again (after sign-up). */
export async function resendConfirmation(client: SupabaseClient, email: string, redirectTo: string): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return invalid(authCopy.invalidEmail);
  const { error } = await client.auth.resend({ type: 'signup', email: clean, options: { emailRedirectTo: redirectTo } });
  return error ? failure(error) : { ok: true };
}

/** "Forgot password": emails a link that opens `redirectTo` (the app's reset-password screen). */
export async function sendPasswordReset(client: SupabaseClient, email: string, redirectTo: string): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return invalid(authCopy.invalidEmail);
  const { error } = await client.auth.resetPasswordForEmail(clean, { redirectTo });
  return error ? failure(error) : { ok: true };
}

/** Set a new password for the signed-in (recovery) session. */
export async function updatePassword(client: SupabaseClient, password: string): Promise<AuthResult> {
  if (!isValidPassword(password)) return invalid(authCopy.shortPassword, 'weak_password');
  const { error } = await client.auth.updateUser({ password });
  return error ? failure(error) : { ok: true };
}

/** "Email me a sign-in code": a 6-digit code works on any device, with no deep link. Creates the account if needed. */
export async function sendEmailCode(client: SupabaseClient, email: string): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return invalid(authCopy.invalidEmail);
  const { error } = await client.auth.signInWithOtp({ email: clean });
  return error ? failure(error) : { ok: true };
}

export async function verifyEmailCode(client: SupabaseClient, email: string, code: string): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  const token = cleanCode(code);
  if (!isValidEmail(clean)) return invalid(authCopy.invalidEmail);
  if (!isValidCode(token)) return invalid(authCopy.invalidCode, 'invalid_code');
  const { error } = await client.auth.verifyOtp({ email: clean, token, type: 'email' });
  if (!error) return { ok: true };
  const m = mapCodeError(error);
  return { ok: false, error: m.message, kind: m.kind };
}

/** Finish a link: trade the PKCE `code` from the callback URL for a session. */
export async function exchangeCode(client: SupabaseClient, code: string): Promise<AuthResult> {
  const { error } = await client.auth.exchangeCodeForSession(code);
  return error ? failure(error) : { ok: true };
}

/** Send a magic link. `redirectTo` is the URL the link opens (web origin or app deep link). */
export async function signInWithMagicLink(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) return { ok: false, error: authCopy.invalidEmail };
  const { error } = await client.auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: redirectTo },
  });
  return error ? failure(error) : { ok: true };
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
  if (error) return oauthFailure(error);
  if (!native || !data?.url) return { ok: true };
  const resultUrl = await openAuthSession!(data.url, redirectTo);
  if (!resultUrl) return { ok: false, error: authCopy.genericError };
  const code = new URL(resultUrl).searchParams.get('code');
  if (!code) return { ok: false, error: authCopy.genericError };
  return exchangeCode(client, code);
}

/**
 * Native iOS: Sign in with Apple identity token -> Supabase session. `rawNonce` is the un-hashed nonce whose SHA-256
 * was given to Apple; Supabase checks the two match.
 */
export async function signInWithAppleToken(
  client: SupabaseClient,
  identityToken: string | null | undefined,
  rawNonce: string,
): Promise<AuthResult> {
  if (!identityToken || !rawNonce) return { ok: false, error: authCopy.genericError };
  const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce: rawNonce });
  return error ? oauthFailure(error) : { ok: true };
}

/**
 * Native iOS/Android: Google ID token -> Supabase session. The Google Sign-In library cannot set a nonce, so none is
 * sent; "Skip nonce checks" must be on for the Google provider in Supabase (owner step in #89).
 */
export async function signInWithGoogleToken(client: SupabaseClient, idToken: string | null | undefined): Promise<AuthResult> {
  if (!idToken) return { ok: false, error: authCopy.genericError };
  const { error } = await client.auth.signInWithIdToken({ provider: 'google', token: idToken });
  return error ? oauthFailure(error) : { ok: true };
}

/** What Apple returns for the name, on the first sign-in only. */
export interface AppleFullName {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
}

/** "Given Family" from Apple's name parts, or null when Apple sent none (every sign-in after the first). */
export function appleDisplayName(name: AppleFullName | null | undefined): string | null {
  const full = [name?.givenName, name?.familyName].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  return full ? full.slice(0, 80) : null;
}

/**
 * Apple sends the name once, so keep it now: write it to the profile unless the profile already has one. Returns
 * whether a name was sent. Never throws: a failed save must not block signing in.
 */
export async function saveAppleName(client: SupabaseClient, userId: string, name: AppleFullName | null | undefined): Promise<boolean> {
  const display = appleDisplayName(name);
  if (!display) return false;
  try {
    await client.from('profiles').update({ display_name: display } as never).eq('user_id', userId).is('display_name', null);
  } catch {
    /* ignore */
  }
  return true;
}

export type SignInMethodId = 'email' | OAuthProvider;
export const SIGN_IN_METHODS: readonly SignInMethodId[] = ['email', 'google', 'apple'];

interface IdentityLike {
  provider: string;
}

/** Which sign-in methods the account has, in a fixed order. Providers we don't offer (e.g. phone) are ignored. */
export function linkedMethods(identities: readonly IdentityLike[] | null | undefined): SignInMethodId[] {
  const have = new Set((identities ?? []).map((i) => i.provider));
  return SIGN_IN_METHODS.filter((m) => have.has(m));
}

/** Unlinking is never allowed for the last way to log in (counting every identity, offered or not). */
export const canUnlink = (identities: readonly IdentityLike[] | null | undefined): boolean => (identities?.length ?? 0) > 1;

export async function fetchIdentities(client: SupabaseClient) {
  const { data, error } = await client.auth.getUserIdentities();
  if (error) throw error;
  return data?.identities ?? [];
}

/** Link Google or Apple to the signed-in account. Same redirect/native handling as signing in. */
export async function linkProvider(
  client: SupabaseClient,
  provider: OAuthProvider,
  redirectTo: string,
  openAuthSession?: (url: string, redirectTo: string) => Promise<string | null>,
): Promise<AuthResult> {
  const native = Boolean(openAuthSession);
  const { data, error } = await client.auth.linkIdentity({ provider, options: { redirectTo, skipBrowserRedirect: native } });
  if (error) return oauthFailure(error);
  if (!native || !data?.url) return { ok: true };
  const resultUrl = await openAuthSession!(data.url, redirectTo);
  if (!resultUrl) return { ok: false, error: authCopy.genericError };
  const code = new URL(resultUrl).searchParams.get('code');
  return code ? exchangeCode(client, code) : { ok: false, error: authCopy.genericError };
}

/** Unlink a provider, unless it is the last identity. */
export async function unlinkProvider(client: SupabaseClient, provider: OAuthProvider): Promise<AuthResult> {
  const identities = await fetchIdentities(client);
  const identity = identities.find((i) => i.provider === provider);
  if (!identity) return { ok: true };
  if (!canUnlink(identities)) return { ok: false, error: authCopy.methods.lastMethod, kind: 'unknown' };
  const { error } = await client.auth.unlinkIdentity(identity);
  return error ? oauthFailure(error) : { ok: true };
}

/** Belt and braces: the DB trigger creates the row; this covers users created before it existed. */
export async function ensureProfile(client: SupabaseClient, userId: string): Promise<void> {
  await client
    .from('profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
}

export async function signOut(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signOut();
  return error ? failure(error) : { ok: true };
}
