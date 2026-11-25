import { describe, expect, it } from 'vitest';
import { mergeAttribution, parseAttribution, utmProps } from './attribution.ts';
import { buildCapiEvent, dedupId, sendCapiEvents, sha256Hex, trackingAllowed } from './capi.ts';

const now = new Date('2026-12-01T10:00:00Z');

describe('parseAttribution', () => {
  it('reads UTM tags and turns fbclid into the fbc value Meta expects', () => {
    const a = parseAttribution('?utm_source=meta&utm_medium=paid&utm_campaign=launch_1&fbclid=AbC123&other=x', now);
    expect(a).toEqual({ utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'launch_1', fbc: `fb.1.${now.getTime()}.AbC123`, first_seen: now.toISOString() });
  });
  it('gives nothing for untagged visits and ignores junk values', () => {
    expect(parseAttribution('', now)).toEqual({});
    expect(parseAttribution('?foo=bar', now)).toEqual({});
    expect(parseAttribution('?utm_source=<script>alert(1)</script>&utm_medium=' + 'x'.repeat(200), now)).toEqual({ utm_medium: 'x'.repeat(80), first_seen: now.toISOString() });
  });
  it('accepts a query string without the question mark', () => {
    expect(parseAttribution('utm_source=tiktok', now).utm_source).toBe('tiktok');
  });
});

describe('mergeAttribution', () => {
  const first = { utm_source: 'meta', first_seen: 'a' };
  it('keeps the first touch and ignores later tags', () => {
    expect(mergeAttribution(first, { utm_source: 'google', first_seen: 'b' })).toEqual(first);
  });
  it('takes the incoming tags when nothing is stored yet', () => {
    expect(mergeAttribution(null, { utm_source: 'meta', first_seen: 'a' })).toEqual(first);
    expect(mergeAttribution({}, {})).toEqual({});
  });
  it('fills in the browser id later without touching the tags', () => {
    expect(mergeAttribution(first, { fbp: 'fb.1.1.2' })).toEqual({ ...first, fbp: 'fb.1.1.2' });
    expect(mergeAttribution({ fbp: 'old' }, { utm_source: 'meta' })).toEqual({ utm_source: 'meta', fbp: 'old' });
  });
  it('exposes only the UTM tags as event props', () => {
    expect(utmProps({ utm_source: 'meta', fbc: 'x', fbp: 'y', first_seen: 'z' })).toEqual({ utm_source: 'meta' });
  });
});

describe('Meta Conversions API', () => {
  it('hashes the email (trimmed, lower case) and never sends it in clear', async () => {
    const e = await buildCapiEvent({ name: 'Purchase', eventId: 'purchase_in_1', user: { email: '  Test@Example.com ', fbp: 'fb.1.1.2', ip: '1.2.3.4', userAgent: 'UA' }, value: { amount: 19.989 }, now });
    expect(e.user_data.em).toEqual([await sha256Hex('test@example.com')]);
    expect(e.user_data.em).toEqual(['973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b']);
    expect(JSON.stringify(e)).not.toContain('Example.com');
    expect(e).toMatchObject({ event_name: 'Purchase', event_id: 'purchase_in_1', event_time: 1_796_119_200, action_source: 'website', custom_data: { value: 19.99, currency: 'USD' } });
    expect(e.user_data).toMatchObject({ fbp: 'fb.1.1.2', client_ip_address: '1.2.3.4', client_user_agent: 'UA' });
  });
  it('omits what it does not have', async () => {
    const e = await buildCapiEvent({ name: 'Lead', eventId: 'lead_x', user: {}, now });
    expect(e.user_data).toEqual({});
    expect(e.custom_data).toBeUndefined();
  });
  it('builds dedup ids that the browser and the server can both compute', () => {
    expect(dedupId.lead('anon-1')).toBe('lead_anon-1');
    expect(dedupId.trial('sub_1')).toBe('trial_sub_1');
    expect(dedupId.purchase('in_1')).toBe('purchase_in_1');
  });
  it('allows tracking only when the latest marketing consent says yes', () => {
    const r = (kind: string, accepted: boolean, at: string) => ({ kind, accepted, accepted_at: at });
    expect(trackingAllowed([])).toBe(false);
    expect(trackingAllowed([r('terms', true, '2026-01-01')])).toBe(false);
    expect(trackingAllowed([r('marketing', true, '2026-01-01')])).toBe(true);
    expect(trackingAllowed([r('marketing', true, '2026-01-01'), r('marketing', false, '2026-02-01')])).toBe(false);
    expect(trackingAllowed([r('marketing', false, '2026-01-01'), r('marketing', true, '2026-02-01')])).toBe(true);
  });
  it('sends events to the Graph API and never throws', async () => {
    const calls: { url: string; body: string }[] = [];
    const ok = (async (url: string, init: RequestInit) => { calls.push({ url, body: String(init.body) }); return new Response('{}', { status: 200 }); }) as unknown as typeof fetch;
    const ev = await buildCapiEvent({ name: 'Lead', eventId: 'lead_x', user: {}, now });
    expect(await sendCapiEvents({ pixelId: '123', accessToken: 't', testEventCode: 'TEST1' }, [ev], ok)).toBe(true);
    expect(calls[0].url).toBe('https://graph.facebook.com/v21.0/123/events');
    expect(JSON.parse(calls[0].body)).toMatchObject({ test_event_code: 'TEST1', data: [{ event_id: 'lead_x' }] });
    const boom = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
    expect(await sendCapiEvents({ pixelId: '123', accessToken: 't' }, [ev], boom)).toBe(false);
    expect(await sendCapiEvents({ pixelId: undefined, accessToken: 't' }, [ev], ok)).toBe(false);
    expect(await sendCapiEvents({ pixelId: '123', accessToken: 't' }, [], ok)).toBe(false);
  });
});
