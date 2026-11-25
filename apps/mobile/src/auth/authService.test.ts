import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ensureProfile,
  exchangeCode,
  isValidEmail,
  resendConfirmation,
  sendEmailCode,
  sendPasswordReset,
  signInWithAppleToken,
  signInWithMagicLink,
  signInWithOAuth,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
  verifyEmailCode,
} from './authService';
import { authCopy } from './copy';

function mockClient(overrides: Record<string, unknown> = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const auth = {
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: 'https://idp/auth' }, error: null }),
    signInWithIdToken: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    resend: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  const client = { auth, from: vi.fn(() => ({ upsert })) };
  return { client: client as unknown as SupabaseClient, auth, upsert };
}

describe('isValidEmail', () => {
  it('accepts and rejects', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('signInWithMagicLink', () => {
  it('sends a normalised OTP with redirect', async () => {
    const { client, auth } = mockClient();
    const r = await signInWithMagicLink(client, ' A@B.co ', 'https://app/');
    expect(r).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      options: { emailRedirectTo: 'https://app/' },
    });
  });
  it('rejects invalid email without calling Supabase', async () => {
    const { client, auth } = mockClient();
    const r = await signInWithMagicLink(client, 'x', 'https://app/');
    expect(r).toEqual({ ok: false, error: authCopy.invalidEmail });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
  it('maps errors to friendly copy', async () => {
    const { client } = mockClient({ signInWithOtp: vi.fn().mockResolvedValue({ error: new Error('boom') }) });
    expect(await signInWithMagicLink(client, 'a@b.co', 'u')).toEqual({ ok: false, error: authCopy.genericError, kind: 'unknown' });
  });
});

describe('signInWithOAuth', () => {
  it('web: lets the browser redirect', async () => {
    const { client, auth } = mockClient();
    expect(await signInWithOAuth(client, 'google', 'https://app/')).toEqual({ ok: true });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app/', skipBrowserRedirect: false },
    });
  });
  it('native: opens the session and exchanges the code', async () => {
    const { client, auth } = mockClient();
    const open = vi.fn().mockResolvedValue('fuelift://auth?code=abc');
    expect(await signInWithOAuth(client, 'apple', 'fuelift://auth', open)).toEqual({ ok: true });
    expect(open).toHaveBeenCalledWith('https://idp/auth', 'fuelift://auth');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });
  it('native: fails when the user cancels or no code returns', async () => {
    const { client } = mockClient();
    const bad = { ok: false, error: authCopy.genericError };
    expect(await signInWithOAuth(client, 'google', 'r', vi.fn().mockResolvedValue(null))).toEqual(bad);
    expect(await signInWithOAuth(client, 'google', 'r', vi.fn().mockResolvedValue('fuelift://auth'))).toEqual(bad);
  });
});

describe('signInWithAppleToken', () => {
  it('exchanges the identity token', async () => {
    const { client, auth } = mockClient();
    expect(await signInWithAppleToken(client, 'tok')).toEqual({ ok: true });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'tok' });
  });
  it('fails without a token', async () => {
    const { client } = mockClient();
    expect((await signInWithAppleToken(client, null)).ok).toBe(false);
  });
});

describe('ensureProfile / signOut', () => {
  it('upserts the profile row idempotently', async () => {
    const { client, upsert } = mockClient();
    await ensureProfile(client, 'u1');
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1' }, { onConflict: 'user_id', ignoreDuplicates: true });
  });
  it('signs out', async () => {
    const { client, auth } = mockClient();
    expect(await signOut(client)).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe('signUpWithPassword', () => {
  it('creates the account with a normalised email and the redirect, and asks for confirmation', async () => {
    const { client, auth } = mockClient();
    expect(await signUpWithPassword(client, ' A@B.co ', 'longenough', 'https://app/auth')).toEqual({ ok: true, needsConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'a@b.co', password: 'longenough', options: { emailRedirectTo: 'https://app/auth' } });
  });
  it('signed in straight away when the project does not require confirmation', async () => {
    const { client } = mockClient({ signUp: vi.fn().mockResolvedValue({ data: { user: { identities: [{}] }, session: { access_token: 't' } }, error: null }) });
    expect(await signUpWithPassword(client, 'a@b.co', 'longenough', 'u')).toEqual({ ok: true, needsConfirmation: false });
  });
  it('an existing address (no identities) is "already registered", not a silent success', async () => {
    const { client } = mockClient({ signUp: vi.fn().mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null }) });
    const r = await signUpWithPassword(client, 'a@b.co', 'longenough', 'u');
    expect(r).toMatchObject({ ok: false, kind: 'already_registered' });
  });
  it('checks email and password before calling Supabase', async () => {
    const { client, auth } = mockClient();
    expect(await signUpWithPassword(client, 'x', 'longenough', 'u')).toMatchObject({ ok: false, error: authCopy.invalidEmail });
    expect(await signUpWithPassword(client, 'a@b.co', 'short', 'u')).toMatchObject({ ok: false, kind: 'weak_password', error: authCopy.shortPassword });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it('maps a rate limit', async () => {
    const { client } = mockClient({ signUp: vi.fn().mockResolvedValue({ data: {}, error: { code: 'over_email_send_rate_limit', message: 'x', status: 429 } }) });
    expect(await signUpWithPassword(client, 'a@b.co', 'longenough', 'u')).toEqual({ ok: false, error: 'Too many emails. Try again in a few minutes.', kind: 'email_rate_limit' });
  });
});

describe('signInWithPassword', () => {
  it('logs in with a normalised email', async () => {
    const { client, auth } = mockClient();
    expect(await signInWithPassword(client, ' A@B.co ', 'pw')).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' });
  });
  it('wrong credentials and unconfirmed email are told apart', async () => {
    const wrong = mockClient({ signInWithPassword: vi.fn().mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }) });
    expect(await signInWithPassword(wrong.client, 'a@b.co', 'x')).toMatchObject({ ok: false, kind: 'invalid_credentials' });
    const unconfirmed = mockClient({ signInWithPassword: vi.fn().mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } }) });
    expect(await signInWithPassword(unconfirmed.client, 'a@b.co', 'x')).toMatchObject({ ok: false, kind: 'email_not_confirmed' });
  });
  it('does not call Supabase with an empty password', async () => {
    const { client, auth } = mockClient();
    expect(await signInWithPassword(client, 'a@b.co', '')).toMatchObject({ ok: false, kind: 'invalid_credentials' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('resend, reset and update password', () => {
  it('resends the sign-up confirmation', async () => {
    const { client, auth } = mockClient();
    expect(await resendConfirmation(client, ' A@B.co ', 'https://app/auth')).toEqual({ ok: true });
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.co', options: { emailRedirectTo: 'https://app/auth' } });
  });
  it('sends the reset link to the reset screen', async () => {
    const { client, auth } = mockClient();
    expect(await sendPasswordReset(client, 'a@b.co', 'https://app/reset-password')).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', { redirectTo: 'https://app/reset-password' });
    expect(await sendPasswordReset(client, 'nope', 'u')).toMatchObject({ ok: false, error: authCopy.invalidEmail });
  });
  it('updates the password only when it is long enough', async () => {
    const { client, auth } = mockClient();
    expect(await updatePassword(client, 'short')).toMatchObject({ ok: false, kind: 'weak_password' });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(await updatePassword(client, 'longenough')).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'longenough' });
  });
});

describe('email code', () => {
  it('sends a code without a redirect, so it works on any device', async () => {
    const { client, auth } = mockClient();
    expect(await sendEmailCode(client, ' A@B.co ')).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co' });
  });
  it('verifies a cleaned 6-digit code as type email', async () => {
    const { client, auth } = mockClient();
    expect(await verifyEmailCode(client, 'a@b.co', '123 456')).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' });
  });
  it('rejects a short code locally and maps a wrong one to a code message', async () => {
    const { client, auth } = mockClient({ verifyOtp: vi.fn().mockResolvedValue({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } }) });
    expect(await verifyEmailCode(client, 'a@b.co', '123')).toMatchObject({ ok: false, kind: 'invalid_code' });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(await verifyEmailCode(client, 'a@b.co', '123456')).toMatchObject({ ok: false, kind: 'invalid_code', error: authCopy.errors.invalidCode });
  });
});

describe('exchangeCode', () => {
  it('trades the callback code for a session', async () => {
    const { client, auth } = mockClient();
    expect(await exchangeCode(client, 'abc')).toEqual({ ok: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });
  it('an expired code is a friendly error', async () => {
    const { client } = mockClient({ exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { code: 'flow_state_expired', message: 'x' } }) });
    expect(await exchangeCode(client, 'abc')).toMatchObject({ ok: false, kind: 'link_expired' });
  });
});
