import 'server-only';
import { requireAdmin } from './session';
import { createAdminClient } from './supabase/admin';
import { daysAgo } from './metrics';

// Dashboard queries. Service role, server only. Each function checks `requireAdmin()` itself (defence in depth:
// a layout is not an authorization boundary). They read the daily views (aggregates), never raw user rows.

const db = () => createAdminClient();

export async function funnelRows(days = 30) {
  await requireAdmin();
  const { data } = await db().from('analytics_funnel_daily').select('day,name,visitors,events').gte('day', daysAgo(days));
  return (data ?? []) as { day: string; name: string; visitors: number; events: number }[];
}
export async function aiUsageRows(days = 30) {
  await requireAdmin();
  const { data } = await db().from('ai_usage_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as {
    day: string; role: string; model: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number; avg_latency_ms: number;
    errors: number; escalated_calls: number; refusals: number; qa_fails: number; retried_calls: number;
  }[];
}
export async function guardrailRows(days = 30) {
  await requireAdmin();
  const { data } = await db().from('guardrail_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as { day: string; field: string | null; category: string; action: string; events: number }[];
}
export async function revenueRows(days = 30) {
  await requireAdmin();
  const { data } = await db().from('revenue_net_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as { day: string; tier: string; gross_usd: number; fees_usd: number; refunds_usd: number; net_usd: number }[];
}

// ---------- E-31: Overview, Funnel, AI health

export async function subscriptionRows() {
  await requireAdmin();
  const { data } = await db().from('entitlements').select('tier,status,price_key,updated_at');
  return (data ?? []) as { tier: string; status: string; price_key: string | null; updated_at: string }[];
}
export async function priceRows() {
  await requireAdmin();
  const { data } = await db().from('plan_prices').select('lookup_key,tier,interval,cents,variant');
  return (data ?? []) as { lookup_key: string; tier: string; interval: string; cents: number; variant: string }[];
}
/** Trial starts and purchases, for the trial to paid rate. */
export async function trialEvents(days = 60) {
  await requireAdmin();
  const { data } = await db().from('analytics_events').select('user_id,name,created_at').in('name', ['trial_start', 'purchase']).gte('created_at', daysAgo(days)).limit(10_000);
  return (data ?? []) as { user_id: string | null; name: string; created_at: string }[];
}
export async function costEntries() {
  await requireAdmin();
  const { data } = await db().from('cost_entries').select('amount_usd,recurrence,incurred_on');
  return (data ?? []) as { amount_usd: number; recurrence: string; incurred_on: string }[];
}
export async function adInsights(days = 30) {
  await requireAdmin();
  const { data } = await db().from('ad_insights_daily').select('spend,trials').gte('day', daysAgo(days));
  return (data ?? []) as { spend: number | null; trials: number | null }[];
}
/** Funnel steps per day and source. Filter by source with `source`. */
export async function funnelBySource(days = 30, source?: string) {
  await requireAdmin();
  let q = db().from('funnel_by_source_daily').select('day,source,name,events,visitors').gte('day', daysAgo(days));
  if (source) q = q.eq('source', source);
  const { data } = await q;
  return (data ?? []) as { day: string; source: string; name: string; events: number; visitors: number }[];
}
export async function onboardingScreens(days = 30, source?: string) {
  await requireAdmin();
  let q = db().from('onboarding_screens_daily').select('day,source,screen,visitors').gte('day', daysAgo(days));
  if (source) q = q.eq('source', source);
  const { data } = await q;
  return (data ?? []) as { day: string; source: string; screen: number; visitors: number }[];
}
export async function generationDaily(days = 30) {
  await requireAdmin();
  const { data } = await db().from('generation_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as { day: string; jobs: number; done: number; failed: number; users: number; first_pass: number; retried: number; escalated: number; fallback: number; needs_review: number }[];
}
export async function generationAttempts(days = 30) {
  await requireAdmin();
  const { data } = await db().from('generation_attempts').select('outcome,errors').gte('day', daysAgo(days)).limit(10_000);
  return (data ?? []).map((r) => ({ outcome: String(r.outcome), errors: (Array.isArray(r.errors) ? r.errors : []) as string[] }));
}
export async function aiLatency(days = 30) {
  await requireAdmin();
  const { data } = await db().from('ai_latency_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as { day: string; role: string; calls: number; p50_ms: number; p95_ms: number }[];
}
export async function activePrompts() {
  await requireAdmin();
  const { data } = await db().from('prompt_versions').select('name,version,model').eq('active', true).order('name');
  return (data ?? []) as { name: string; version: number; model: string | null }[];
}
/** Distinct users who started a generation in the period (a sum of daily distinct counts would count a person twice). */
export async function generationUserCount(days = 30) {
  await requireAdmin();
  const { data } = await db().from('generation_jobs').select('user_id').gte('created_at', daysAgo(days)).limit(50_000);
  return new Set((data ?? []).map((r) => r.user_id as string)).size;
}

// ---------- E-32: Users and Guardrails

export interface UserListRow {
  id: string;
  email: string | null;
  created_at: string;
  last_active: string | null;
  tier: string;
  status: string;
  current_period_end: string | null;
}
/** Users with their plan and last activity. `search` matches part of the email or the exact id. */
export async function userList(search: string, page = 0, size = 50) {
  await requireAdmin();
  const { data } = await db().rpc('admin_user_list', { p_search: search || null, p_limit: size, p_offset: page * size } as never);
  return (data ?? []) as unknown as UserListRow[];
}

/** Everything the detail page shows. Health data: the caller must have written the audit row first. */
export async function userDetail(id: string) {
  await requireAdmin();
  const c = db();
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString();
  const [auth, profile, ent, jobs, sessions] = await Promise.all([
    c.auth.admin.getUserById(id),
    c.from('profiles').select('display_name,sex,birth_date,height_cm,weight_kg,goal,experience,units,locale,onboarding,attribution,created_at').eq('user_id', id).maybeSingle(),
    c.from('entitlements').select('tier,status,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,source,price_key,updated_at').eq('user_id', id).maybeSingle(),
    c.from('generation_jobs').select('id,kind,status,created_at,needs_review,result').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    c.from('workout_sessions').select('started_at').eq('user_id', id).not('finished_at', 'is', null).gte('started_at', since),
  ]);
  return {
    user: auth.data.user ? { id: auth.data.user.id, email: auth.data.user.email ?? null, created_at: auth.data.user.created_at, last_sign_in_at: auth.data.user.last_sign_in_at ?? null } : null,
    profile: profile.data as Record<string, unknown> | null,
    entitlement: ent.data as { tier: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean; stripe_customer_id: string | null; stripe_subscription_id: string | null; source: string; price_key: string | null; updated_at: string } | null,
    jobs: (jobs.data ?? []) as { id: string; kind: string; status: string; created_at: string; needs_review: boolean | null; result: unknown }[],
    sessionDates: ((sessions.data ?? []) as { started_at: string }[]).map((s) => s.started_at),
  };
}

export interface QueueRow {
  id: string;
  user_id: string | null;
  field: string | null;
  rule: string;
  action: string;
  input_text: string | null;
  created_at: string;
}
/** Blocked inputs waiting for a reviewer, newest first. The user's text is in here: audit before calling. */
export async function guardrailQueue(limit = 100) {
  await requireAdmin();
  const { data } = await db()
    .from('guardrail_events')
    .select('id,user_id,field,rule,action,input_text,created_at')
    .is('reviewed_at', null)
    .not('input_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as QueueRow[];
}
