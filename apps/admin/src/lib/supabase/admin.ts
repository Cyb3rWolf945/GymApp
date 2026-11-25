import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. `server-only` makes the build fail if a client component ever imports this file.
 * Use it only in server components, server actions and route handlers, after `requireAdmin()`.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
