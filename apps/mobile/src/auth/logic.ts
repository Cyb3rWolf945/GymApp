// Pure helpers for the auth screens: validators, the resend cooldown and the auth callback URL.

export const MIN_PASSWORD_LENGTH = 8;
export const RESEND_COOLDOWN_SECONDS = 60;
export const OTP_LENGTH = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email.trim());
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const isValidPassword = (password: string): boolean => password.length >= MIN_PASSWORD_LENGTH;
/** Keep only the digits a person typed or pasted ("123 456" → "123456"), at most six. */
export const cleanCode = (raw: string): string => raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
export const isValidCode = (code: string): boolean => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);

/** Seconds until "Resend email" is allowed again (0 = now). `sentAt` and `now` are epoch ms. */
export function resendWait(sentAt: number | null, now: number, cooldown = RESEND_COOLDOWN_SECONDS): number {
  if (sentAt === null) return 0;
  return Math.max(0, Math.ceil((sentAt + cooldown * 1000 - now) / 1000));
}

export interface AuthCallback {
  /** PKCE code to exchange for a session. */
  code?: string;
  /** Set when the link failed (`#error=access_denied&error_code=otp_expired…`). */
  error?: string;
  errorCode?: string;
  /** `recovery` = the link from "Forgot password". */
  type?: string;
}

/**
 * Read an auth callback URL: web (`https://app/auth?code=…`, errors in the `#` fragment) and native
 * (`fuelift://auth?code=…`). Never throws; anything unparseable is an empty result.
 */
export function parseAuthCallback(url: string | null | undefined): AuthCallback {
  if (!url) return {};
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const query = q >= 0 ? url.slice(q + 1, h >= 0 && h > q ? h : undefined) : '';
  const fragment = h >= 0 ? url.slice(h + 1) : '';
  const params = new URLSearchParams(query);
  const frag = new URLSearchParams(fragment);
  const get = (k: string) => params.get(k) ?? frag.get(k) ?? undefined;
  const result: AuthCallback = {};
  const code = get('code');
  const error = get('error_description') ?? get('error');
  const errorCode = get('error_code');
  const type = get('type');
  if (code) result.code = code;
  if (error) result.error = error;
  if (errorCode) result.errorCode = errorCode;
  if (type) result.type = type;
  return result;
}
