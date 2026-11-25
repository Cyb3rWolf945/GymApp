import 'server-only';
import { createAdminClient } from './supabase/admin';
import { daysAgo } from './metrics';

// Dashboard queries. Service role, server only, always behind `requireAdmin()`. They read the daily views
// (aggregates), never raw user rows.

const db = () => createAdminClient();

export async function funnelRows(days = 30) {
  const { data } = await db().from('analytics_funnel_daily').select('day,name,visitors,events').gte('day', daysAgo(days));
  return (data ?? []) as { day: string; name: string; visitors: number; events: number }[];
}
export async function aiUsageRows(days = 30) {
  const { data } = await db().from('ai_usage_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as {
    day: string; role: string; model: string; calls: number; tokens_in: number; tokens_out: number; cost_usd: number; avg_latency_ms: number;
    errors: number; escalated_calls: number; refusals: number; qa_fails: number; retried_calls: number;
  }[];
}
export async function guardrailRows(days = 30) {
  const { data } = await db().from('guardrail_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as { day: string; field: string | null; category: string; action: string; events: number }[];
}
export async function revenueRows(days = 30) {
  const { data } = await db().from('revenue_net_daily').select('*').gte('day', daysAgo(days)).order('day');
  return (data ?? []) as { day: string; tier: string; gross_usd: number; fees_usd: number; refunds_usd: number; net_usd: number }[];
}
