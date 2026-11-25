import { LEGAL_VERSIONS } from './docs.ts';

// Consent records: what the user accepted in onboarding, with the version of the text they saw.

export interface ConsentAnswers {
  terms: boolean;
  privacy: boolean;
  healthData: boolean;
  disclaimer: boolean;
  notifications: boolean;
}

export interface ConsentRow {
  user_id: string;
  kind: 'terms' | 'privacy' | 'health_data' | 'disclaimer' | 'notifications' | 'marketing';
  version: string;
  accepted: boolean;
  accepted_at: string;
}

/** Notification reminders are not a legal document: their version is just the consent screen's. */
export const NOTIFICATIONS_CONSENT_VERSION = '1';
/** Version of the tracking (cookie) banner text. */
export const MARKETING_CONSENT_VERSION = '1';

/**
 * Rows for `consent_records`. The four required consents are recorded only if given (the quiz cannot finish
 * without them); health-data consent is tied to the privacy policy text, the disclaimer to the health disclaimer.
 * The optional notification choice is recorded either way, and so is the tracking choice (`marketing`) when one was made.
 */
export function consentRows(userId: string, c: ConsentAnswers, now = new Date(), marketing: boolean | null = null): ConsentRow[] {
  const at = now.toISOString();
  const row = (kind: ConsentRow['kind'], version: string, accepted: boolean): ConsentRow => ({ user_id: userId, kind, version, accepted, accepted_at: at });
  return [
    ...(c.terms ? [row('terms', LEGAL_VERSIONS.terms, true)] : []),
    ...(c.privacy ? [row('privacy', LEGAL_VERSIONS.privacy, true)] : []),
    ...(c.healthData ? [row('health_data', LEGAL_VERSIONS.privacy, true)] : []),
    ...(c.disclaimer ? [row('disclaimer', LEGAL_VERSIONS.health, true)] : []),
    row('notifications', NOTIFICATIONS_CONSENT_VERSION, c.notifications),
    // The cookie banner choice (accept or reject), when the visitor made one on the web.
    ...(marketing === null ? [] : [row('marketing', MARKETING_CONSENT_VERSION, marketing)]),
  ];
}
