// Edge Function: stripe-webhook. Stripe -> entitlements.
// Verifies the signature, is idempotent by event.id (stripe_events), and maps events with handleStripeEvent.
// Deploy with --no-verify-jwt: Stripe has no Supabase JWT; the signature is the authentication.
import { createClient } from '@supabase/supabase-js';
import { analyticsFromStripeEvent } from '../../../packages/shared/src/analytics/index.ts';
import { type StripeEvent, type StripeSubscription, handleStripeEvent, stripeClient, verifyStripeSignature } from '../../../packages/shared/src/payments/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const payload = await req.text(); // the raw body: the signature covers exact bytes
  if (!(await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''))) {
    return json(400, { error: 'Invalid signature.' });
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json(400, { error: 'Invalid payload.' });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only
  const stripe = stripeClient(Deno.env.get('STRIPE_SECRET_KEY')!);

  // Idempotency: the first delivery inserts the row; a repeat hits the primary key and is acknowledged untouched.
  const { error: dup } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return dup.code === '23505' ? json(200, { ok: true, duplicate: true }) : json(500, { error: 'Could not record event.' });

  try {
    const outcome = await handleStripeEvent(event, {
      findUserByCustomer: async (customer) =>
        (await admin.from('entitlements').select('user_id').eq('stripe_customer_id', customer).maybeSingle()).data?.user_id ?? null,
      getEntitlement: async (userId) => (await admin.from('entitlements').select('status,past_due_since').eq('user_id', userId).maybeSingle()).data,
      getSubscription: (id) => stripe<StripeSubscription>('GET', `/subscriptions/${id}`),
      getChargeCustomer: async (chargeId) => (await stripe<{ customer: string | null }>('GET', `/charges/${chargeId}`)).customer,
    });
    if (outcome.kind === 'update') {
      const { error } = await admin.from('entitlements').upsert({ user_id: outcome.userId, ...outcome.patch, updated_at: new Date().toISOString() } as never);
      if (error) throw error;
    }
    // Money events (trial_start, purchase) for the funnel and the dashboards. A failure here must not fail the webhook.
    const derived = analyticsFromStripeEvent(event, outcome);
    if (derived) await admin.from('analytics_events').insert({ user_id: derived.userId, name: derived.name, props: derived.props });
    return json(200, { ok: true, outcome: outcome.kind });
  } catch {
    // Let Stripe retry: forget the event so the next delivery is processed.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return json(500, { error: 'Could not process event.' });
  }
});
