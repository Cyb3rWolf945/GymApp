// Edge Function: stripe-checkout. POST { priceKey, founding? } with the user's JWT -> { url } of a Stripe Checkout page (web).
// Prices are resolved by lookup_key (see packages/shared/src/payments/pricing.ts); the trial applies to annual plans only.
import { createClient } from '@supabase/supabase-js';
import { FOUNDING_COUPON, type PlanPriceRow, priceByKey, resolvePrices, stripeClient } from '../../../packages/shared/src/payments/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json(401, { error: 'Sign in to continue.' });

  const body = (await req.json().catch(() => null)) as { priceKey?: string; founding?: boolean } | null;
  const spec = body?.priceKey ? priceByKey(body.priceKey) : undefined;
  if (!spec) return json(400, { error: 'Pick a plan.' });
  const founding = body?.founding === true && spec.lookupKey === FOUNDING_COUPON.lookupKey;

  const stripe = stripeClient(Deno.env.get('STRIPE_SECRET_KEY')!);
  // The price comes from plan_prices (so it changes without a deploy). The A/B variant is chosen here from the
  // user id, never trusted from the client. No stripe_price_id on the row = resolve by lookup_key in Stripe.
  const { data: rows } = await admin.from('plan_prices').select('lookup_key,tier,interval,cents,variant,stripe_price_id,active').eq('active', true);
  const row = resolvePrices((rows ?? []) as PlanPriceRow[], user.id).prices.find((r) => r.lookup_key === spec.lookupKey);
  let priceId = row?.stripe_price_id ?? null;
  if (!priceId) {
    const prices = await stripe<{ data: { id: string }[] }>('GET', '/prices', { lookup_keys: [spec.lookupKey], active: true });
    priceId = prices.data[0]?.id ?? null;
  }
  if (!priceId) return json(500, { error: 'This plan is not available yet.' });
  const price = { id: priceId };

  // One Stripe customer per user.
  const { data: ent } = await admin.from('entitlements').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  let customer = ent?.stripe_customer_id ?? null;
  if (!customer) {
    customer = (await stripe<{ id: string }>('POST', '/customers', { email: user.email, metadata: { user_id: user.id } })).id;
    await admin.from('entitlements').upsert({ user_id: user.id, stripe_customer_id: customer } as never);
  }

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:8081';
  const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id, price_variant: row?.variant ?? 'default' }, trial_period_days: spec.trialDays > 0 ? spec.trialDays : undefined },
    discounts: founding ? [{ coupon: FOUNDING_COUPON.id }] : undefined,
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/paywall`,
  });
  return json(200, { url: session.url });
});
