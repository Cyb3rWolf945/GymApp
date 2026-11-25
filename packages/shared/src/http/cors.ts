// CORS for the Edge Functions the web app calls from the browser (supabase-js `functions.invoke`).
// Browsers send an OPTIONS preflight first; without these headers every call from the web build fails.

export const CORS_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
export const CORS_ALLOWED_METHODS = 'POST, OPTIONS';

/**
 * The allowed origins: a comma-separated list (env `ALLOWED_ORIGINS`, falling back to `APP_URL`).
 * Only these origins get CORS headers; there is no wildcard, because the calls carry the user's token.
 */
export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** Headers to add for a request from `origin`. Empty when the origin is missing or not allowed. */
export function corsHeadersFor(origin: string | null | undefined, allowed: readonly string[]): Record<string, string> {
  const base = { Vary: 'Origin' };
  if (!origin || !allowed.includes(origin.replace(/\/+$/, ''))) return base;
  return {
    ...base,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    'Access-Control-Max-Age': '86400',
  };
}

type Handler = (req: Request) => Promise<Response> | Response;

/**
 * Wrap a function handler: answer the preflight (204) and add the CORS headers to every response, including errors.
 * `allowed` is read per request so tests (and env changes) take effect without a restart.
 */
export function withCors(handler: Handler, allowed: () => readonly string[]): Handler {
  return async (req) => {
    const headers = corsHeadersFor(req.headers.get('Origin'), allowed());
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const res = await handler(req);
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(headers)) out.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
  };
}

/** Allowed origins from the function environment: `ALLOWED_ORIGINS` (comma list), else `APP_URL`, else local dev. */
export const originsFromEnv = (get: (key: string) => string | undefined): string[] =>
  parseAllowedOrigins(get('ALLOWED_ORIGINS') ?? get('APP_URL') ?? 'http://localhost:8081');
