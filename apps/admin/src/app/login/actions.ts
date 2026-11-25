'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Email and password only checks who you are. The backoffice itself needs the admins table and a TOTP code. */
export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const { error } = await (await createClient()).auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=1');
  // `requireAdmin` decides where they go next (forbidden, enrol, verify or the overview).
  redirect('/');
}
