// Ad attribution captured on the web landing page: UTM tags plus the Facebook click id. First touch wins.

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** Facebook click id as Meta wants it for matching: `fb.1.<ms timestamp>.<fbclid>`. */
  fbc?: string;
  /** Facebook browser id from the `_fbp` cookie (only exists after tracking consent). */
  fbp?: string;
  /** When the first tagged visit happened (ISO). */
  first_seen?: string;
}

const MAX = 80;
const clean = (v: string | null | undefined): string | undefined => {
  const s = (v ?? '').trim().slice(0, MAX);
  // Tags are short identifiers. Drop anything with control characters or markup.
  return s && /^[\w .,:;@%+~/=-]+$/.test(s) ? s : undefined;
};

/** UTM tags and fbclid from a query string (`?utm_source=meta&...`). Unknown keys are ignored; empty result = no tags. */
export function parseAttribution(search: string, now = new Date()): Attribution {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out: Attribution = {};
  for (const k of UTM_KEYS) {
    const v = clean(params.get(k));
    if (v) out[k] = v;
  }
  const fbclid = clean(params.get('fbclid'));
  if (fbclid) out.fbc = `fb.1.${now.getTime()}.${fbclid}`;
  if (Object.keys(out).length > 0) out.first_seen = now.toISOString();
  return out;
}

/** First touch wins for tags; the browser id can be filled in later. */
export function mergeAttribution(stored: Attribution | null | undefined, incoming: Attribution): Attribution {
  const hasTags = (a: Attribution | null | undefined) => !!a && (UTM_KEYS.some((k) => a[k]) || !!a.fbc);
  const base = hasTags(stored) ? { ...stored } : { ...incoming, ...(stored?.fbp ? { fbp: stored.fbp } : {}) };
  const fbp = incoming.fbp ?? stored?.fbp;
  return { ...base, ...(fbp ? { fbp } : {}) };
}

/** Props for the `landing_view` event: the UTM tags only. */
export const utmProps = (a: Attribution): Partial<Record<UtmKey, string>> => Object.fromEntries(UTM_KEYS.filter((k) => a[k]).map((k) => [k, a[k]]));
