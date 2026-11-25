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
