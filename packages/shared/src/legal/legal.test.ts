import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS, LEGAL_KINDS, LEGAL_VERSIONS, REVIEW_NOTICE, legalDoc } from './docs.ts';
import { NOTIFICATIONS_CONSENT_VERSION, consentRows } from './consents.ts';
import { EXPORT_TABLES, buildExport } from './export.ts';

describe('legal documents', () => {
  it('has terms, privacy and health disclaimer, each marked as a template for legal review', () => {
    expect([...LEGAL_KINDS]).toEqual(['terms', 'privacy', 'health']);
    for (const kind of LEGAL_KINDS) {
      const d = LEGAL_DOCS[kind];
      expect(d.reviewNotice).toBe(REVIEW_NOTICE);
      expect(d.reviewNotice.toLowerCase()).toContain('legal review');
      expect(d.version).toBe(LEGAL_VERSIONS[kind]);
      expect(d.sections.length).toBeGreaterThan(2);
      for (const s of d.sections) expect(s.body.length, `${kind}/${s.heading}`).toBeGreaterThan(20);
    }
  });
  it('privacy policy covers health data consent, processors, retention and the user rights', () => {
    const text = LEGAL_DOCS.privacy.sections.map((s) => `${s.heading} ${s.body}`).join(' ').toLowerCase();
    for (const word of ['health data', 'explicit consent', 'stripe', 'supabase', 'delete your account', 'download']) expect(text, word).toContain(word);
  });
  it('looks documents up by route name and rejects unknown ones', () => {
    expect(legalDoc('privacy')?.title).toBe('Privacy policy');
    expect(legalDoc('cookies')).toBeNull();
    expect(legalDoc('__proto__')).toBeNull();
  });
});

describe('consentRows', () => {
  const all = { terms: true, privacy: true, healthData: true, disclaimer: true, notifications: false };
  const now = new Date('2026-12-01T10:00:00Z');
  it('records each consent with the version of the text and the time', () => {
    const rows = consentRows('u1', all, now);
    expect(rows.map((r) => [r.kind, r.version, r.accepted])).toEqual([
      ['terms', LEGAL_VERSIONS.terms, true],
      ['privacy', LEGAL_VERSIONS.privacy, true],
      ['health_data', LEGAL_VERSIONS.privacy, true],
      ['disclaimer', LEGAL_VERSIONS.health, true],
      ['notifications', NOTIFICATIONS_CONSENT_VERSION, false],
    ]);
    expect(new Set(rows.map((r) => r.accepted_at))).toEqual(new Set(['2026-12-01T10:00:00.000Z']));
    expect(rows.every((r) => r.user_id === 'u1')).toBe(true);
  });
  it('records the tracking choice only when the visitor made one, accepted or not', () => {
    expect(consentRows('u1', all, now).some((r) => r.kind === 'marketing')).toBe(false);
    expect(consentRows('u1', all, now, true).at(-1)).toMatchObject({ kind: 'marketing', version: '1', accepted: true });
    expect(consentRows('u1', all, now, false).at(-1)).toMatchObject({ kind: 'marketing', accepted: false });
  });
  it('never records a required consent that was not given, but always records the notification choice', () => {
    const rows = consentRows('u1', { ...all, healthData: false, notifications: true }, now);
    expect(rows.map((r) => r.kind)).toEqual(['terms', 'privacy', 'disclaimer', 'notifications']);
    expect(rows.at(-1)?.accepted).toBe(true);
  });
});

describe('buildExport', () => {
  it('has a key for every exported table, hides Stripe ids, and keeps the rest', () => {
    const out = buildExport(
      'u1',
      'a@b.co',
      { profiles: [{ user_id: 'u1', height_cm: 180 }], entitlements: [{ user_id: 'u1', tier: 'pro', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }] },
      new Date('2026-12-01T10:00:00Z'),
    );
    expect(Object.keys(out.data).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(out.data.profiles).toEqual([{ user_id: 'u1', height_cm: 180 }]);
    expect(out.data.entitlements).toEqual([{ user_id: 'u1', tier: 'pro' }]);
    expect(out.data.set_logs).toEqual([]);
    expect(out).toMatchObject({ userId: 'u1', email: 'a@b.co', exportedAt: '2026-12-01T10:00:00.000Z' });
  });
});
