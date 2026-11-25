// Edge Function: stripe-portal. POST with the user's JWT -> { url } of the Stripe Customer Portal (manage or cancel).
import { createClient } from '@supabase/supabase-js';
import { stripeClient } from '../../../packages/shared/src/payments/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json(401, { error: 'Sign in to continue.' });

  const { data: ent } = await admin.from('entitlements').select('stripe_customer_id').eq('user_id', auth.user.id).maybeSingle();
  if (!ent?.stripe_customer_id) return json(404, { error: 'No subscription yet.' });

  const stripe = stripeClient(Deno.env.get('STRIPE_SECRET_KEY')!);
  const session = await stripe<{ url: string }>('POST', '/billing_portal/sessions', {
    customer: ent.stripe_customer_id,
    return_url: Deno.env.get('APP_URL') ?? 'http://localhost:8081',
  });
  return json(200, { url: session.url });
});
