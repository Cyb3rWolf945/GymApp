import { describe, expect, it } from 'vitest';
import { cleanCode, isValidCode, isValidEmail, isValidPassword, normalizeEmail, parseAuthCallback, resendWait, visibleProviders } from './logic';

describe('validators', () => {
  it('email', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(normalizeEmail('  A@B.Co ')).toBe('a@b.co');
  });
  it('password: at least 8 characters, spaces count, no trimming', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('       ')).toBe(false);
    expect(isValidPassword('        ')).toBe(true);
  });
  it('code: exactly six digits; pasted codes are cleaned', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('1234567890')).toBe('123456');
    expect(cleanCode('abc')).toBe('');
  });
});

describe('resendWait (60 s cooldown)', () => {
  it('is zero before anything was sent and after a minute', () => {
    expect(resendWait(null, 1_000_000)).toBe(0);
    expect(resendWait(1_000_000, 1_060_000)).toBe(0);
    expect(resendWait(1_000_000, 1_090_000)).toBe(0);
  });
  it('counts down in whole seconds, rounding up', () => {
    expect(resendWait(1_000_000, 1_000_000)).toBe(60);
    expect(resendWait(1_000_000, 1_000_500)).toBe(60);
    expect(resendWait(1_000_000, 1_001_000)).toBe(59);
    expect(resendWait(1_000_000, 1_059_999)).toBe(1);
  });
});

describe('parseAuthCallback', () => {
  it('web: code in the query', () => {
    expect(parseAuthCallback('https://app.test/auth?code=abc123')).toEqual({ code: 'abc123' });
  });
  it('native: fuelift://auth?code=…', () => {
    expect(parseAuthCallback('fuelift://auth?code=xyz')).toEqual({ code: 'xyz' });
  });
  it('recovery links carry their type', () => {
    expect(parseAuthCallback('https://app.test/auth?code=abc&type=recovery')).toEqual({ code: 'abc', type: 'recovery' });
  });
  it('errors arrive in the # fragment', () => {
    expect(parseAuthCallback('https://app.test/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toEqual({
      error: 'Email link is invalid or has expired',
      errorCode: 'otp_expired',
    });
  });
  it('errors can also be in the query', () => {
    expect(parseAuthCallback('fuelift://auth?error=access_denied&error_code=otp_expired')).toEqual({ error: 'access_denied', errorCode: 'otp_expired' });
  });
  it('query and fragment together', () => {
    expect(parseAuthCallback('https://a.test/auth?code=c#type=recovery')).toEqual({ code: 'c', type: 'recovery' });
  });
  it('never throws on junk', () => {
    expect(parseAuthCallback(null)).toEqual({});
    expect(parseAuthCallback(undefined)).toEqual({});
    expect(parseAuthCallback('')).toEqual({});
    expect(parseAuthCallback('not a url')).toEqual({});
    expect(parseAuthCallback('https://a.test/auth?code=')).toEqual({});
  });
});

describe('visibleProviders (App Store rule)', () => {
  it('shows Apple on iOS whenever Google is shown', () => {
    expect(visibleProviders({ google: true, apple: false }, 'ios')).toEqual({ google: true, apple: true });
  });
  it('uses the flags as set elsewhere', () => {
    expect(visibleProviders({ google: true, apple: false }, 'android')).toEqual({ google: true, apple: false });
    expect(visibleProviders({ google: false, apple: false }, 'web')).toEqual({ google: false, apple: false });
    expect(visibleProviders({ google: false, apple: true }, 'ios')).toEqual({ google: false, apple: true });
  });
});
