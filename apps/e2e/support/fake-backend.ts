import type { Page, Request, Route } from '@playwright/test';
import { EXERCISES, NUTRITION_PLAN, PLAN_PRICES, RECIPES, USER, WORKOUT_PLAN, fakeSession, sessionHistory, setLogHistory, weightHistory } from './fixtures';

// A small in-memory stand-in for Supabase (auth, PostgREST tables, RPC and the Edge Functions the app calls).
// It answers by table and ignores row filters: there is one synthetic user. It records every write so tests can
// assert on what the app sent. Stripe Checkout itself is not exercised (see the funnel test).

export const API_URL = 'http://localhost:54321';

export interface Recorded {
  method: string;
  path: string;
  body: unknown;
}

/** The auth server's side of the story: accounts, and the emails it would have sent (a stand-in for Mailpit). */
export interface AuthState {
  /** Like the Supabase project setting "Confirm email". Off by default so the funnel flows straight through. */
  confirmEmails: boolean;
  accounts: Map<string, { password: string; confirmed: boolean }>;
  mailbox: { to: string; kind: 'confirm' | 'reset' | 'code'; /** The `?code=` of the link, or the 6 digits. */ code: string }[];
}

/** The 6-digit code the fake "emails" for the sign-in code option. */
export const FAKE_EMAIL_CODE = '123456';

export interface Backend {
  auth: AuthState;
  /** Every non-GET request the app made. */
  writes: Recorded[];
  /** Calls to Edge Functions, by name. */
  functionCalls: string[];
  state: { entitled: boolean; jobs: unknown[]; profile: Record<string, unknown> | null; checked: string[]; /** Weights, sets and workouts from the last weeks (Progress screen, store screenshots). Off by default. */ history: Date | null };
  /** What the Stripe webhook would do after a successful payment. */
  completeCheckout(): void;
  writesTo(path: string): Recorded[];
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': '*',
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

function parseBody(req: Request): unknown {
  const raw = req.postData();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const now = () => new Date().toISOString();

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

/** The `col=eq.x` and `col=in.(a,b)` filters PostgREST applies. A filter on a column the fixture row doesn't have is ignored. */
export function applyFilters(rows: unknown[], params: URLSearchParams): unknown[] {
  let out = rows as Record<string, unknown>[];
  for (const [col, expr] of params) {
    if (RESERVED.has(col)) continue;
    const eq = /^eq\.(.*)$/.exec(expr);
    const inn = /^in\.\((.*)\)$/.exec(expr);
    if (!eq && !inn) continue;
    const wanted = eq ? [eq[1]] : inn![1].split(',').map((v) => v.replace(/^"|"$/g, ''));
    out = out.filter((r) => !(col in r) || wanted.includes(String(r[col])));
  }
  return out;
}

export async function installFakeBackend(page: Page, opts: { checkoutUrl: string }): Promise<Backend> {
  const state: Backend['state'] = { entitled: false, jobs: [], profile: null, checked: [], history: null };
  const writes: Recorded[] = [];
  const functionCalls: string[] = [];
  const auth: AuthState = { confirmEmails: false, accounts: new Map(), mailbox: [] };
  const authUser = (email: string) => ({ ...(fakeSession().user as object), email, identities: [{ identity_id: 'i', provider: 'email' }], email_confirmed_at: now() });
  const authSession = (email: string) => ({ ...fakeSession(), user: authUser(email) });
  const authError = (route: Route, status: number, errorCode: string, msg: string) => json(route, { code: status, error_code: errorCode, msg }, status);
  let pendingConfirm: string | null = null;

  const doneJob = (kind: 'workout_plan' | 'nutrition_plan') => ({
    id: kind === 'workout_plan' ? '20000000-0000-4000-8000-000000000001' : '20000000-0000-4000-8000-000000000002',
    kind,
    status: 'done',
    created_at: now(),
    result: { plan: kind === 'workout_plan' ? WORKOUT_PLAN : NUTRITION_PLAN },
    error: null,
  });

  const entitlement = () => ({ user_id: USER.id, tier: 'pro', status: 'active', current_period_end: '2100-01-01T00:00:00Z', past_due_since: null });

  const tables: Record<string, () => unknown[]> = {
    profiles: () => (state.profile ? [state.profile] : []),
    entitlements: () => (state.entitled ? [entitlement()] : []),
    generation_jobs: () => state.jobs,
    exercises: () => EXERCISES,
    recipes: () => RECIPES,
    plan_prices: () => PLAN_PRICES,
    shopping_list_items: () => state.checked.map((label) => ({ label, checked: true })),
    body_metrics: () => (state.history ? weightHistory(state.history) : []),
    set_logs: () => (state.history ? setLogHistory(state.history) : []),
    workout_sessions: () => (state.history ? sessionHistory(state.history) : []),
  };

  await page.route(/localhost:54321/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = url.pathname;

    // ---- Auth
    if (path.startsWith('/auth/v1/') && path !== '/auth/v1/user' && path !== '/auth/v1/logout') {
      const body = (parseBody(req) ?? {}) as Record<string, unknown>;
      const email = String(body.email ?? '').toLowerCase();
      const grant = url.searchParams.get('grant_type');
      if (path === '/auth/v1/signup') {
        if (auth.accounts.has(email)) return json(route, { ...authUser(email), identities: [] }); // existing address: no error, no identities
        auth.accounts.set(email, { password: String(body.password ?? ''), confirmed: !auth.confirmEmails });
        if (!auth.confirmEmails) return json(route, authSession(email));
        pendingConfirm = email;
        auth.mailbox.push({ to: email, kind: 'confirm', code: 'confirm-code' });
        return json(route, { ...authUser(email), email_confirmed_at: null });
      }
      if (path === '/auth/v1/token' && grant === 'password') {
        const acct = auth.accounts.get(email);
        if (!acct || acct.password !== body.password) return authError(route, 400, 'invalid_credentials', 'Invalid login credentials');
        if (!acct.confirmed) return authError(route, 400, 'email_not_confirmed', 'Email not confirmed');
        return json(route, authSession(email));
      }
      if (path === '/auth/v1/token' && grant === 'pkce') {
        // The link in the confirmation or reset email: it confirms the pending account and starts a session.
        const target = pendingConfirm ?? [...auth.accounts.keys()][0] ?? USER.email;
        const acct = auth.accounts.get(target);
        if (acct) acct.confirmed = true;
        pendingConfirm = null;
        return json(route, authSession(target));
      }
      if (path === '/auth/v1/resend') {
        auth.mailbox.push({ to: email, kind: 'confirm', code: 'confirm-code' });
        return json(route, {});
      }
      if (path === '/auth/v1/recover') {
        auth.mailbox.push({ to: email, kind: 'reset', code: 'reset-code' });
        return json(route, {});
      }
      if (path === '/auth/v1/otp') {
        auth.mailbox.push({ to: email, kind: 'code', code: FAKE_EMAIL_CODE });
        return json(route, {});
      }
      if (path === '/auth/v1/verify') {
        if (body.token !== FAKE_EMAIL_CODE) return authError(route, 403, 'otp_expired', 'Token has expired or is invalid');
        if (!auth.accounts.has(email)) auth.accounts.set(email, { password: '', confirmed: true });
        return json(route, authSession(email));
      }
    }
    if (path === '/auth/v1/user' && method === 'PUT') {
      const body = (parseBody(req) ?? {}) as { password?: string };
      const acct = auth.accounts.get(USER.email) ?? [...auth.accounts.values()][0];
      if (acct && body.password) acct.password = body.password;
      return json(route, authUser(USER.email));
    }
    if (path === '/auth/v1/otp') return json(route, {});
    if (path === '/auth/v1/user') return json(route, { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now() });
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });

    // ---- Edge Functions
    if (path.startsWith('/functions/v1/')) {
      const name = path.replace('/functions/v1/', '');
      functionCalls.push(name);
      writes.push({ method, path, body: parseBody(req) });
      if (name === 'generate-plan') {
        // The real function runs the LLM (free `dev` models). Here the plan is ready straight away.
        state.jobs = [doneJob('workout_plan'), doneJob('nutrition_plan')];
        return json(route, { jobId: 'job' }, 202);
      }
      if (name === 'stripe-checkout') return json(route, { url: opts.checkoutUrl });
      if (name === 'track-event') return route.fulfill({ status: 204, headers: CORS });
      return json(route, {});
    }

    // ---- RPC
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.replace('/rest/v1/rpc/', '');
      if (fn === 'my_access') return json(route, state.entitled);
      return json(route, []);
    }

    // ---- Tables
    if (path.startsWith('/rest/v1/')) {
      const table = path.replace('/rest/v1/', '');
      if (method === 'GET' || method === 'HEAD') return json(route, applyFilters((tables[table] ?? (() => []))(), url.searchParams));
      const body = parseBody(req);
      writes.push({ method, path, body });
      if (table === 'profiles' && body && !Array.isArray(body)) state.profile = { ...(state.profile ?? {}), ...(body as object) };
      if (table === 'shopping_list_items' && body && !Array.isArray(body)) {
        const row = body as { label: string; checked: boolean };
        state.checked = row.checked ? [...new Set([...state.checked, row.label])] : state.checked.filter((l) => l !== row.label);
      }
      if (method === 'DELETE') return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 201, headers: { ...CORS, 'content-type': 'application/json' }, body: '[]' });
    }

    return json(route, { error: `unhandled ${method} ${path}` }, 404);
  });

  return {
    auth,
    writes,
    functionCalls,
    state,
    completeCheckout: () => {
      state.entitled = true;
    },
    writesTo: (p) => writes.filter((w) => w.path.endsWith(p)),
  };
}
