import type { Page, Request, Route } from '@playwright/test';
import { EXERCISES, NUTRITION_PLAN, PLAN_PRICES, RECIPES, USER, WORKOUT_PLAN, sessionHistory, setLogHistory, weightHistory } from './fixtures';

// A small in-memory stand-in for Supabase (auth, PostgREST tables, RPC and the Edge Functions the app calls).
// It answers by table and ignores row filters: there is one synthetic user. It records every write so tests can
// assert on what the app sent. Stripe Checkout itself is not exercised (see the funnel test).

export const API_URL = 'http://localhost:54321';

export interface Recorded {
  method: string;
  path: string;
  body: unknown;
}

export interface Backend {
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
    writes,
    functionCalls,
    state,
    completeCheckout: () => {
      state.entitled = true;
    },
    writesTo: (p) => writes.filter((w) => w.path.endsWith(p)),
  };
}
