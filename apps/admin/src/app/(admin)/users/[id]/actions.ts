'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit, requireAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { canComp, deleteConfirmed, validateCompGrant } from '@/lib/users';

// Every action: requireAdmin() first, the audit row BEFORE the change (if the audit write fails nothing happens),
// then the change. Results come back as `?done=` or `?error=` on the user page.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function target(formData: FormData): string {
  const id = String(formData.get('userId') ?? '');
  if (!UUID.test(id)) redirect('/users');
  return id;
}
const back = (id: string, key: 'done' | 'error', value: string): never => redirect(`/users/${id}?${key}=${encodeURIComponent(value)}`);

/** Call an Edge Function for a user with the service-role key (only this server has it). */
async function callFunction(name: string, body: Record<string, unknown>): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function grantComp(formData: FormData) {
  const admin = await requireAdmin();
  const userId = target(formData);
  const grant = validateCompGrant({ tier: String(formData.get('tier') ?? ''), endDate: String(formData.get('endDate') ?? '') });
  if (!grant.ok) return back(userId, 'error', grant.error);

  const db = createAdminClient();
  const { data: ent } = await db.from('entitlements').select('stripe_subscription_id,status').eq('user_id', userId).maybeSingle();
  if (!canComp(ent)) return back(userId, 'error', 'This user has a live Stripe subscription. Change it in Stripe instead.');

  await audit({ adminId: admin.id, action: 'grant_comp', target: `user:${userId}`, details: { tier: grant.tier, ends_at: grant.endsAt } });
  const { error } = await db.from('entitlements').upsert({
    user_id: userId, tier: grant.tier, status: 'active', current_period_end: grant.endsAt, cancel_at_period_end: false, source: 'comp', past_due_since: null, updated_at: new Date().toISOString(),
  } as never);
  if (error) return back(userId, 'error', "Couldn't save the plan. Try again.");
  revalidatePath(`/users/${userId}`);
  return back(userId, 'done', `Granted ${grant.tier} until ${grant.endsAt.slice(0, 10)}.`);
}

export async function regeneratePlan(formData: FormData) {
  const admin = await requireAdmin();
  const userId = target(formData);
  await audit({ adminId: admin.id, action: 'regenerate_plan', target: `user:${userId}` });
  const results = await Promise.all((['workout_plan', 'nutrition_plan'] as const).map((kind) => callFunction('generate-plan', { userId, kind })));
  if (results.some((ok) => !ok)) return back(userId, 'error', "Couldn't start the new plan. Check the AI health page and try again.");
  revalidatePath(`/users/${userId}`);
  return back(userId, 'done', 'New workout and meal plans are being built. They show up here when they are done.');
}

export async function resendMagicLink(formData: FormData) {
  const admin = await requireAdmin();
  const userId = target(formData);
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  const email = data.user?.email;
  if (!email) return back(userId, 'error', 'This user has no email address.');
  await audit({ adminId: admin.id, action: 'resend_magic_link', target: `user:${userId}` });
  // The link is sent by Supabase Auth to the user's own address, as if they had asked for it themselves.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: process.env.APP_URL } });
  if (error) return back(userId, 'error', "Couldn't send the link. Try again in a minute.");
  return back(userId, 'done', 'A new sign-in link was sent to the user.');
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = target(formData);
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  if (!data.user) return back(userId, 'error', 'This user no longer exists.');
  if (!deleteConfirmed(String(formData.get('confirm') ?? ''), { id: userId, email: data.user.email ?? null })) {
    return back(userId, 'error', "That doesn't match. Type the user's email exactly to delete the account.");
  }
  await audit({ adminId: admin.id, action: 'delete_user', target: `user:${userId}` });
  // Same erasure as the user's own "Delete account": cancels Stripe, erases traces, deletes the auth user (cascades).
  const ok = await callFunction('delete-account', { userId, confirm: 'DELETE' });
  if (!ok) return back(userId, 'error', "Couldn't delete the account. Nothing was deleted if Stripe failed; try again in a minute.");
  redirect('/users?deleted=1');
}
