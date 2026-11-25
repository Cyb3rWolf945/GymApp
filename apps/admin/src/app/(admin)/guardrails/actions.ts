'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit, requireAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS = ['approved', 'kept_blocked', 'contacted'] as const;
type Decision = (typeof DECISIONS)[number];

/**
 * Record the reviewer's decision on one blocked input: approve (a false alarm), keep it blocked, or contact the user.
 * Reviewing marks the event as reviewed, so the user's text is removed by the next daily purge: it is kept only as
 * long as the decision needs it. The decision is audited before it is saved.
 */
export async function reviewGuardrail(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('eventId') ?? '');
  const decision = String(formData.get('decision') ?? '') as Decision;
  if (!UUID.test(id) || !DECISIONS.includes(decision)) redirect('/guardrails');

  const db = createAdminClient();
  const { data: event } = await db.from('guardrail_events').select('user_id').eq('id', id).is('reviewed_at', null).maybeSingle();
  if (!event) redirect('/guardrails');

  await audit({ adminId: admin.id, action: 'review_guardrail', target: `guardrail:${id}`, details: { decision } });
  const { error } = await db
    .from('guardrail_events')
    .update({ review_decision: decision, reviewed_at: new Date().toISOString(), reviewed_by: admin.id } as never)
    .eq('id', id)
    .is('reviewed_at', null);
  if (error) redirect('/guardrails?error=1');
  revalidatePath('/guardrails');
  // To contact the user, go to their page: it shows the address (that view is audited too).
  redirect(decision === 'contacted' && event.user_id ? `/users/${event.user_id}?contact=1` : '/guardrails');
}
