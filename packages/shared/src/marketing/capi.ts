// Meta Conversions API (server side events). Built here, sent from Edge Functions.
// Rules: only for users who accepted tracking; email is hashed (SHA-256) before it leaves; no health data ever;
// every event has an `event_id` so Meta can deduplicate it against the browser Pixel.

export const CAPI_VERSION = 'v21.0';

export type CapiEventName = 'Lead' | 'StartTrial' | 'Purchase';

export interface CapiUserData {
  /** Plain email: hashed by `buildCapiEvent`. */
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface CapiEvent {
  event_name: CapiEventName;
  event_time: number;
  event_id: string;
  action_source: 'website';
  event_source_url?: string;
  user_data: Record<string, string | string[]>;
  custom_data?: { value: number; currency: string };
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Same id in the browser Pixel (`eventID`) and here (`event_id`) = one conversion in Meta. */
export const dedupId = {
  lead: (anonId: string) => `lead_${anonId}`,
  trial: (subscriptionId: string) => `trial_${subscriptionId}`,
  purchase: (invoiceId: string) => `purchase_${invoiceId}`,
};

export async function buildCapiEvent(args: {
  name: CapiEventName;
  eventId: string;
  user: CapiUserData;
  value?: { amount: number; currency?: string };
  sourceUrl?: string;
  now?: Date;
}): Promise<CapiEvent> {
  const u: Record<string, string | string[]> = {};
  const email = args.user.email?.trim().toLowerCase();
  if (email) u.em = [await sha256Hex(email)];
  if (args.user.fbp) u.fbp = args.user.fbp;
  if (args.user.fbc) u.fbc = args.user.fbc;
  if (args.user.ip) u.client_ip_address = args.user.ip;
  if (args.user.userAgent) u.client_user_agent = args.user.userAgent;
  return {
    event_name: args.name,
    event_time: Math.floor((args.now ?? new Date()).getTime() / 1000),
    event_id: args.eventId,
    action_source: 'website',
    ...(args.sourceUrl ? { event_source_url: args.sourceUrl } : {}),
    user_data: u,
    ...(args.value ? { custom_data: { value: Math.round(args.value.amount * 100) / 100, currency: (args.value.currency ?? 'USD').toUpperCase() } } : {}),
  };
}

/** Does the user's latest `marketing` consent record say yes? No record = no. */
export function trackingAllowed(records: readonly { kind: string; accepted: boolean; accepted_at: string }[]): boolean {
  const latest = records.filter((r) => r.kind === 'marketing').sort((a, b) => b.accepted_at.localeCompare(a.accepted_at))[0];
  return latest?.accepted === true;
}

/** POST events to Meta. Never throws: a tracking failure must not break sign-up, checkout or the Stripe webhook. */
export async function sendCapiEvents(
  cfg: { pixelId: string | undefined; accessToken: string | undefined; testEventCode?: string | undefined },
  events: readonly CapiEvent[],
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (!cfg.pixelId || !cfg.accessToken || events.length === 0) return false;
  try {
    const res = await fetchFn(`https://graph.facebook.com/${CAPI_VERSION}/${cfg.pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ data: events, ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
