// Edge Function: stripe-reconcile. Run daily (Supabase cron / scheduled invocation) with the service-role key as bearer token.
// 1) Re-reads every subscription from Stripe and corrects `entitlements` if a webhook was missed.
// 2) Rebuilds `revenue_daily` for the last 3 days from balance transactions (gross, fees, refunds).
import { createClient } from '@supabase/supabase-js';
import {
  type StripeSubscription, type Tier, aggregateRevenue, patchFromSubscription, stripeClient,
} from '../../../packages/shared/src/payments/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DAYS = 3;

Deno.serve(async (req) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${key}`) return json(401, { error: 'Not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key); // server only
  const stripe = stripeClient(Deno.env.get('STRIPE_SECRET_KEY')!);

  const { data: ents } = await admin.from('entitlements').select('user_id,tier,status,stripe_customer_id,stripe_subscription_id,past_due_since').not('stripe_subscription_id', 'is', null);
  let fixed = 0;
  for (const e of ents ?? []) {
    const sub = await stripe<StripeSubscription>('GET', `/subscriptions/${e.stripe_subscription_id}`);
    const patch = patchFromSubscription(sub, e, Math.floor(Date.now() / 1000));
    // Revoked by a refund or dispute: stays revoked, whatever Stripe says about the subscription.
    if (['refunded', 'disputed'].includes(e.status)) continue;
    if (patch.status !== e.status || patch.tier !== e.tier) {
      await admin.from('entitlements').update({ ...patch, updated_at: new Date().toISOString() } as never).eq('user_id', e.user_id);
      fixed++;
    }
  }

  // Revenue: tier comes from the customer's entitlement.
  const tierByCustomer = new Map<string, Tier>((ents ?? []).map((e) => [e.stripe_customer_id as string, e.tier as Tier]));
  // From the start of a UTC day, so every rebuilt day is complete.
  const since = Math.floor(Date.now() / 86_400_000) * 86400 - DAYS * 86400;
  type Bt = { type: string; amount: number; fee: number; created: number; source?: { customer?: string | null; charge?: { customer?: string | null } | string | null } | string | null };
  const txs: { type: string; amount: number; fee: number; created: number; customer: string | null }[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe<{ data: (Bt & { id: string })[]; has_more: boolean }>('GET', '/balance_transactions', {
      limit: 100, 'created[gte]': since, expand: ['data.source', 'data.source.charge'], starting_after: startingAfter,
    } as never);
    for (const t of page.data) {
      const s = typeof t.source === 'object' && t.source ? t.source : null;
      const charge = s && typeof s.charge === 'object' ? s.charge : null;
      txs.push({ type: t.type, amount: t.amount, fee: t.fee, created: t.created, customer: s?.customer ?? charge?.customer ?? null });
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  const rows = aggregateRevenue(txs, (c) => (c ? tierByCustomer.get(c) : undefined) ?? 'none');
  if (rows.length) await admin.from('revenue_daily').upsert(rows as never, { onConflict: 'day,tier' });
  return json(200, { ok: true, checked: ents?.length ?? 0, fixed, revenueRows: rows.length });
});
