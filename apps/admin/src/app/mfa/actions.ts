'use server';

import { redirect } from 'next/navigation';
import { audit, requireAdminForMfa } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

async function challengeAndVerify(factorId: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error || !challenge) return false;
  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  return !verifyError;
}

/** First login: confirm the new authenticator app with a code. */
export async function confirmEnrollment(formData: FormData) {
  const admin = await requireAdminForMfa();
  const ok = await challengeAndVerify(String(formData.get('factorId') ?? ''), String(formData.get('code') ?? '').trim());
  if (!ok) redirect('/mfa/enroll?error=1');
  await audit({ adminId: admin.id, action: 'mfa_enrolled' });
  await audit({ adminId: admin.id, action: 'admin_login' });
  redirect('/');
}

/** Every new session: a fresh code lifts it to aal2. */
export async function verifyCode(formData: FormData) {
  const admin = await requireAdminForMfa();
  const ok = await challengeAndVerify(String(formData.get('factorId') ?? ''), String(formData.get('code') ?? '').trim());
  if (!ok) redirect('/mfa/verify?error=1');
  await audit({ adminId: admin.id, action: 'mfa_verified' });
  await audit({ adminId: admin.id, action: 'admin_login' });
  redirect('/');
}
