import { describe, expect, it } from 'vitest';
import { authCopy } from './copy';
import { mapAuthError, mapCodeError } from './errors';

describe('mapAuthError', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 }, 'invalid_credentials', authCopy.errors.invalidCredentials],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 }, 'email_not_confirmed', authCopy.errors.emailNotConfirmed],
    [{ code: 'user_already_exists', message: 'User already registered', status: 422 }, 'already_registered', authCopy.errors.alreadyRegistered],
    [{ code: 'email_exists', message: 'A user with this email address has already been registered' }, 'already_registered', authCopy.errors.alreadyRegistered],
    [{ code: 'weak_password', message: 'Password should be at least 8 characters' }, 'weak_password', authCopy.errors.weakPassword],
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded', status: 429 }, 'email_rate_limit', 'Too many emails. Try again in a few minutes.'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rate_limit', authCopy.errors.tooManyRequests],
    [{ code: 'provider_disabled', message: 'Unsupported provider: provider is not enabled' }, 'provider_disabled', authCopy.errors.providerDisabled],
    [{ code: 'signup_disabled', message: 'Signups not allowed for this instance' }, 'signup_disabled', authCopy.errors.signupDisabled],
    [{ code: 'otp_expired', message: 'Email link is invalid or has expired' }, 'link_expired', authCopy.errors.linkExpired],
    [{ code: 'same_password', message: 'New password should be different from the old password.' }, 'same_password', authCopy.errors.samePassword],
  ])('code %j', (error, kind, message) => {
    expect(mapAuthError(error)).toEqual({ kind, message });
  });

  it('falls back to the message when an older server sends no code', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' }).kind).toBe('invalid_credentials');
    expect(mapAuthError({ message: 'Email not confirmed' }).kind).toBe('email_not_confirmed');
    expect(mapAuthError({ message: 'User already registered' }).kind).toBe('already_registered');
    expect(mapAuthError({ message: 'email rate limit exceeded' }).kind).toBe('email_rate_limit');
    expect(mapAuthError({ message: 'Unsupported provider: provider is not enabled' }).kind).toBe('provider_disabled');
  });

  it('tells a dropped connection from a real error', () => {
    expect(mapAuthError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }).kind).toBe('network');
    expect(mapAuthError({ message: 'Failed to fetch' }).kind).toBe('network');
  });

  it('keeps a generic message for anything unknown, and never leaks the raw error', () => {
    expect(mapAuthError({ message: 'boom: database exploded at 10.0.0.5' })).toEqual({ kind: 'unknown', message: authCopy.genericError });
    expect(mapAuthError(null)).toEqual({ kind: 'unknown', message: authCopy.genericError });
    expect(mapAuthError(undefined).kind).toBe('unknown');
  });

  it('a bare 429 is a rate limit', () => {
    expect(mapAuthError({ status: 429 }).kind).toBe('rate_limit');
  });

  it('every message follows the writing guide: short, no blame words', () => {
    for (const m of [...Object.values(authCopy.errors), authCopy.genericError, authCopy.invalidEmail, authCopy.shortPassword, authCopy.invalidCode]) {
      expect(m.length).toBeLessThan(120);
      expect(m).not.toMatch(/\b(you failed|your fault|invalid input|error:)\b/i);
    }
  });
});

describe('mapCodeError', () => {
  it('a wrong or expired code reads as a code problem', () => {
    expect(mapCodeError({ code: 'otp_expired' }).kind).toBe('invalid_code');
    expect(mapCodeError({ message: 'Token has expired or is invalid' }).kind).toBe('invalid_code');
    expect(mapCodeError({ message: 'who knows' }).kind).toBe('invalid_code');
  });
  it('still reports a rate limit as a rate limit', () => {
    expect(mapCodeError({ code: 'over_request_rate_limit' }).kind).toBe('rate_limit');
  });
});
