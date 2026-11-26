import type { Page, Request, Route } from '@playwright/test';
import { NUTRITION_PLAN, PLAN_PRICES, RECIPES, USER, WORKOUT_PLAN, exerciseRows, fakeSession, sessionHistory, setLogHistory, weightHistory } from './fixtures';

// A small in-memory stand-in for Supabase (auth, PostgREST tables, RPC and the Edge Functions the app calls).
// It answers by table and ignores row filters: there is one synthetic user. It records every write so tests can
// assert on what the app sent. Stripe Checkout itself is not exercised (see the funnel test).

import type { editableWorkout } from './fixtures';

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
  /** Sign-in methods of the signed-in user (what Settings → "Sign-in methods" lists). */
  identities: string[];
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
  /** Table reads made by the app, by table (to check that polling stops). */
  reads: Record<string, number>;
  state: { entitled: boolean; jobs: unknown[]; profile: Record<string, unknown> | null; checked: string[]; /** Weights, sets and workouts from the last weeks (Progress screen, store screenshots). Off by default. */ history: Date | null; /** Answers of `rpc` calls by function name (default: an empty list). */ rpc: Record<string, unknown>; /** One workout whose sets can be corrected and deleted (History). Writes to `set_logs` / `workout_sessions` change it. */ editable: ReturnType<typeof editableWorkout> | null; /** Writes to the tables fail (no connection); reads still work. */ offline: boolean; /** Weekly check-ins already sent (`weekly-checkin` adds one). */ checkins: { week_start: string }[]; /** Tables whose reads fail with a 500 (a request that fails). Remove a name to let "Try again" succeed. */ failing: string[]; /** Milliseconds to hold table reads, by table (to see the loading skeletons). */ delay: Record<string, number>; /** What `generate-plan` does: `ok` (plans ready at once), `fail-once` (the first pair of calls end as failed jobs), `stuck` (jobs stay `running`). */ generation: 'ok' | 'fail-once' | 'stuck'; /** How many `generate-plan` calls were made, to run `fail-once` once. */ generateCalls: number };
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
  const state: Backend['state'] = { entitled: false, jobs: [], profile: null, checked: [], history: null, rpc: {}, editable: null, offline: false, checkins: [], failing: [], delay: {}, generation: 'ok', generateCalls: 0 };
  const reads: Record<string, number> = {};
  const writes: Recorded[] = [];
  const functionCalls: string[] = [];
  const auth: AuthState = { confirmEmails: false, accounts: new Map(), identities: ['email'], mailbox: [] };
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
    exercises: () => exerciseRows(),
    recipes: () => RECIPES,
    plan_prices: () => PLAN_PRICES,
    shopping_list_items: () => state.checked.map((label) => ({ label, checked: true })),
    body_metrics: () => (state.history ? weightHistory(state.history) : []),
    weekly_checkins: () => state.checkins,
    set_logs: () => (state.editable ? state.editable.sets : state.history ? setLogHistory(state.history) : []),
    workout_sessions: () => (state.editable ? [state.editable.session] : state.history ? sessionHistory(state.history) : []),
  };

  await page.route(/localhost:54321/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = url.pathname;

    // ---- Auth
    if (path === '/auth/v1/authorize') {
      // Google / Apple in the browser: the provider's page is skipped; it sends you straight back with a code.
      const provider = url.searchParams.get('provider') ?? 'google';
      const back = url.searchParams.get('redirect_to') ?? '';
      if (!auth.identities.includes(provider)) auth.identities.push(provider);
      return route.fulfill({ status: 302, headers: { ...CORS, location: `${back}${back.includes('?') ? '&' : '?'}code=fake-${provider}-code` } });
    }
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
    if (path === '/auth/v1/user') return json(route, { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now(), identities: auth.identities.map((provider) => ({ identity_id: `identity-${provider}`, id: USER.id, user_id: USER.id, provider, identity_data: {}, created_at: now() })) });
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });

    // ---- Edge Functions
    if (path.startsWith('/functions/v1/')) {
      const name = path.replace('/functions/v1/', '');
      functionCalls.push(name);
      writes.push({ method, path, body: parseBody(req) });
      if (name === 'generate-plan') {
        // The real function runs the LLM (free `dev` models). Here the plan is ready straight away, unless the test says otherwise.
        state.generateCalls += 1;
        const kind = (parseBody(req) as { kind: 'workout_plan' | 'nutrition_plan' }).kind;
        if (state.generation === 'fail-once' && state.generateCalls <= 2) {
          state.jobs = [...state.jobs, { ...doneJob(kind), status: 'failed', result: null, error: 'Generation failed. Try again.' }];
        } else if (state.generation === 'stuck') {
          state.jobs = [...state.jobs, { ...doneJob(kind), status: 'running', result: null }];
        } else {
          state.jobs = [...(state.jobs as { kind: string; status: string }[]).filter((j) => j.kind !== kind), doneJob(kind)];
        }
        return json(route, { jobId: 'job' }, 202);
      }
      if (name === 'stripe-checkout') return json(route, { url: opts.checkoutUrl });
      if (name === 'weekly-checkin') {
        const sent = parseBody(req) as { weekStart: string };
        state.checkins = [{ week_start: sent.weekStart }];
        return json(route, { ok: true, noteKept: true });
      }
      if (name === 'track-event') return route.fulfill({ status: 204, headers: CORS });
      return json(route, {});
    }

    // ---- RPC
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.replace('/rest/v1/rpc/', '');
      if (fn === 'my_access') return json(route, state.entitled);
      if (fn === 'resolve_weekly_adapt') {
        const b = parseBody(req) as { p_week: string; p_keep: boolean };
        writes.push({ method, path, body: b });
        let n = 0;
        for (const j of state.jobs as Record<string, unknown>[]) if (j.adapt_week === b.p_week && j.adapt_state === 'new') { j.adapt_state = b.p_keep ? 'kept' : 'reverted'; n += 1; }
        return json(route, n);
      }
      return json(route, state.rpc[fn] ?? []);
    }

    // ---- Tables
    if (path.startsWith('/rest/v1/')) {
      const table = path.replace('/rest/v1/', '');
      if (method === 'GET' || method === 'HEAD') {
        reads[table] = (reads[table] ?? 0) + 1;
        if (state.delay[table]) await new Promise((r) => setTimeout(r, state.delay[table]));
        if (state.failing.includes(table)) return json(route, { message: 'The fake backend is set to fail this table.' }, 500);
        return json(route, applyFilters((tables[table] ?? (() => []))(), url.searchParams));
      }
      const body = parseBody(req);
      if (state.offline && (table === 'set_logs' || table === 'workout_sessions')) return route.fulfill({ status: 503, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"message":"offline"}' });
      writes.push({ method, path, body });
      const ed = state.editable;
      if (ed && (table === 'set_logs' || table === 'workout_sessions')) {
        const wantedId = /^eq\.(.*)$/.exec(url.searchParams.get('id') ?? '')?.[1];
        if (method === 'DELETE' && wantedId) {
          if (table === 'set_logs') ed.sets = ed.sets.filter((r: { id: string }) => r.id !== wantedId);
          else if (wantedId === ed.session.id) state.editable = null;
        } else if (table === 'set_logs' && body && !Array.isArray(body)) {
          // An upsert by id: change the stored row (the queued correction carries the whole row).
          const row = body as Record<string, unknown>;
          ed.sets = ed.sets.map((r: { id: string }) => (r.id === row.id ? { ...r, reps: row.reps, weight_kg: row.weight_kg, rpe: row.rpe } : r)) as typeof ed.sets;
        }
      }
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
    reads,
    state,
    completeCheckout: () => {
      state.entitled = true;
    },
    writesTo: (p) => writes.filter((w) => w.path.endsWith(p)),
  };
}
