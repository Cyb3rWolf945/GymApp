// Minimal Stripe REST client (fetch only, so it runs in Deno Edge Functions and in tests).

type Param = string | number | boolean | null | undefined | Param[] | { [k: string]: Param };

/** Stripe's form encoding: nested objects as `a[b]=1`, arrays as `a[0]=x`. Undefined and null are skipped. */
export function encodeForm(params: Record<string, Param>): string {
  const out: string[] = [];
  const walk = (key: string, v: Param) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${key}[${i}]`, x));
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(`${key}[${k}]`, x);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out.join('&');
}

export type StripeFetch = <T = Record<string, unknown>>(method: 'GET' | 'POST' | 'DELETE', path: string, params?: Record<string, Param>) => Promise<T>;

export function stripeClient(secretKey: string, fetchFn: typeof fetch = fetch): StripeFetch {
  return async <T>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, Param> = {}) => {
    const body = encodeForm(params);
    const url = `https://api.stripe.com/v1${path}${method !== 'POST' && body ? `?${body}` : ''}`;
    const res = await fetchFn(url, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body: method === 'POST' ? body : undefined,
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${(json as { error?: { message?: string } }).error?.message ?? 'request failed'}`);
    return json;
  };
}
