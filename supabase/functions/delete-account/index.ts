// Edge Function: delete-account. POST { confirm: 'DELETE' } with the user's JWT.
// Deletes the account and everything we hold about the person (GDPR erasure; also an App Store requirement):
//  1. cancel the Stripe subscription by deleting the Stripe customer (stops billing, removes their details there;
//     Stripe keeps the payment records the law requires). If Stripe fails we stop, so nothing is left billing.
//  2. erase rows that outlive the account (guardrail text, analytics, AI logs): `erase_user_traces`.
//  3. delete the auth user: every other table cascades from it.
import { createClient } from '@supabase/supabase-js';
import { stripeClient } from '../../../packages/shared/src/payments/index.ts';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); // server only
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json(401, { error: 'Sign in to continue.' });

  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== 'DELETE') return json(400, { error: 'Confirm to delete your account.' });

  const { data: ent } = await admin.from('entitlements').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (ent?.stripe_customer_id) {
    try {
      // Deleting the customer cancels its subscriptions immediately.
      await stripeClient(Deno.env.get('STRIPE_SECRET_KEY')!)('DELETE', `/customers/${ent.stripe_customer_id}`);
    } catch (e) {
      // "No such customer" means it is already gone; anything else: stop and let the user retry.
      if (!/No such customer/i.test(String((e as Error).message))) return json(502, { error: "Couldn't cancel your subscription. Try again in a minute." });
    }
  }

  const { error: eraseError } = await admin.rpc('erase_user_traces', { p_user: user.id });
  if (eraseError) return json(500, { error: "Couldn't delete your data. Try again in a minute." });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json(500, { error: "Couldn't delete your account. Try again in a minute." });
  return json(200, { ok: true });
});
