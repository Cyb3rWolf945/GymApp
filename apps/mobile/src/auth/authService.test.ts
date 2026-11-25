import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ensureProfile,
  isValidEmail,
  signInWithAppleToken,
  signInWithMagicLink,
  signInWithOAuth,
  signOut,
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
    expect(await signInWithMagicLink(client, 'a@b.co', 'u')).toEqual({ ok: false, error: authCopy.genericError });
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
