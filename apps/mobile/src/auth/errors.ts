import { authCopy } from './copy';

/** What went wrong, in terms the screen can act on (offer "Resend email", switch to Log in, ...). */
export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'already_registered'
  | 'weak_password'
  | 'email_rate_limit'
  | 'rate_limit'
  | 'provider_disabled'
  | 'signup_disabled'
  | 'invalid_code'
  | 'link_expired'
  | 'same_password'
  | 'other_method'
  | 'identity_in_use'
  | 'linking_off'
  | 'network'
  | 'unknown';

/** The parts of a Supabase `AuthError` we read. */
export interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}

export interface MappedAuthError {
  kind: AuthErrorKind;
  message: string;
}

const MESSAGES: Record<AuthErrorKind, string> = {
  invalid_credentials: authCopy.errors.invalidCredentials,
  email_not_confirmed: authCopy.errors.emailNotConfirmed,
  already_registered: authCopy.errors.alreadyRegistered,
  weak_password: authCopy.errors.weakPassword,
  email_rate_limit: authCopy.errors.rateLimit,
  rate_limit: authCopy.errors.tooManyRequests,
  provider_disabled: authCopy.errors.providerDisabled,
  signup_disabled: authCopy.errors.signupDisabled,
  invalid_code: authCopy.errors.invalidCode,
  link_expired: authCopy.errors.linkExpired,
  same_password: authCopy.errors.samePassword,
  other_method: authCopy.errors.otherMethod,
  identity_in_use: authCopy.errors.identityInUse,
  linking_off: authCopy.errors.linkingOff,
  network: authCopy.errors.network,
  unknown: authCopy.genericError,
};

/** Supabase error codes (`error.code`), the stable way to tell errors apart. */
const BY_CODE: Record<string, AuthErrorKind> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'already_registered',
  email_exists: 'already_registered',
  weak_password: 'weak_password',
  over_email_send_rate_limit: 'email_rate_limit',
  over_request_rate_limit: 'rate_limit',
  over_sms_send_rate_limit: 'rate_limit',
  provider_disabled: 'provider_disabled',
  oauth_provider_not_supported: 'provider_disabled',
  signup_disabled: 'signup_disabled',
  email_provider_disabled: 'signup_disabled',
  otp_expired: 'link_expired',
  otp_disabled: 'provider_disabled',
  flow_state_expired: 'link_expired',
  flow_state_not_found: 'link_expired',
  same_password: 'same_password',
};

/** Fallbacks for older servers that only send a message. */
const BY_MESSAGE: [RegExp, AuthErrorKind][] = [
  [/invalid login credentials/i, 'invalid_credentials'],
  [/email not confirmed/i, 'email_not_confirmed'],
  [/already registered|already been registered/i, 'already_registered'],
  [/password should be|weak password|password is too/i, 'weak_password'],
  [/email rate limit|rate limit exceeded.*email|email.*rate limit/i, 'email_rate_limit'],
  [/rate limit|too many requests|for security purposes/i, 'rate_limit'],
  [/provider is not enabled|unsupported provider/i, 'provider_disabled'],
  [/signups? not allowed|signups? are disabled/i, 'signup_disabled'],
  [/token has expired or is invalid|otp.*(expired|invalid)|invalid.*otp/i, 'invalid_code'],
  [/expired/i, 'link_expired'],
  [/different from the old password|same as the old password/i, 'same_password'],
  [/failed to fetch|network request failed|networkerror|fetch failed/i, 'network'],
];

/** Pure: turn a Supabase auth error into a kind the screen can act on and a friendly message. */
export function mapAuthError(error: AuthErrorLike | null | undefined): MappedAuthError {
  const kind = classify(error);
  return { kind, message: MESSAGES[kind] };
}

function classify(error: AuthErrorLike | null | undefined): AuthErrorKind {
  if (!error) return 'unknown';
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  const message = error.message ?? '';
  for (const [re, kind] of BY_MESSAGE) if (re.test(message)) return kind;
  if (error.status === 429) return 'rate_limit';
  return 'unknown';
}

/**
 * Errors from Google, Apple and linking. An email that already has an account made another way, or an identity that
 * belongs to someone else, gets its own message that says which way to log in. Everything else is `mapAuthError`.
 */
export function mapOAuthError(error: AuthErrorLike | null | undefined): MappedAuthError {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (code === 'identity_already_exists' || /identity.*already.*(linked|exists)/i.test(message)) return { kind: 'identity_in_use', message: MESSAGES.identity_in_use };
  if (code === 'email_exists' || code === 'user_already_exists' || /already (registered|exists)|already been registered/i.test(message)) return { kind: 'other_method', message: MESSAGES.other_method };
  if (code === 'manual_linking_disabled' || /manual linking is disabled/i.test(message)) return { kind: 'linking_off', message: MESSAGES.linking_off };
  return mapAuthError(error);
}

/** A wrong or expired 6-digit code reads better than "link expired". */
export function mapCodeError(error: AuthErrorLike | null | undefined): MappedAuthError {
  const mapped = mapAuthError(error);
  return mapped.kind === 'link_expired' || mapped.kind === 'unknown' ? { kind: 'invalid_code', message: MESSAGES.invalid_code } : mapped;
}
