// Pure helpers for the Users screens: masking, search input, comp grants and the delete confirmation.

/** "ana.silva@example.com" -> "a***@example.com". The list shows this; the full address only on the audited detail page. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(no email)';
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** The search box: trimmed and capped. It is passed to a SQL function as a value, never built into SQL. */
export const cleanSearch = (q: string | undefined | null): string => (q ?? '').trim().slice(0, 100);

export const COMP_TIERS = ['basic', 'pro', 'elite'] as const;
export type CompTier = (typeof COMP_TIERS)[number];
export const MAX_COMP_DAYS = 366;

export type CompResult = { ok: true; tier: CompTier; endsAt: string } | { ok: false; error: string };

/**
 * A comped plan: a tier until an end date (inclusive, end of that UTC day). The end must be in the future and within a
 * year, so a typo cannot hand out a plan for decades.
 */
export function validateCompGrant(input: { tier: string; endDate: string }, now = new Date()): CompResult {
  if (!(COMP_TIERS as readonly string[]).includes(input.tier)) return { ok: false, error: 'Pick a tier.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) return { ok: false, error: 'Pick an end date.' };
  const ends = new Date(`${input.endDate}T23:59:59.000Z`);
  if (Number.isNaN(ends.getTime()) || ends.toISOString().slice(0, 10) !== input.endDate) return { ok: false, error: 'That date does not exist.' };
  if (ends <= now) return { ok: false, error: 'The end date must be in the future.' };
  if (ends.getTime() - now.getTime() > MAX_COMP_DAYS * 86_400_000) return { ok: false, error: `The end date can be at most ${MAX_COMP_DAYS} days away.` };
  return { ok: true, tier: input.tier as CompTier, endsAt: ends.toISOString() };
}

/** A user with a live Stripe subscription is not comped: the next Stripe event would overwrite it. */
export const canComp = (ent: { stripe_subscription_id: string | null; status: string } | null): boolean =>
  !ent?.stripe_subscription_id || !['active', 'trialing', 'past_due'].includes(ent.status);

/** Deleting an account needs the admin to type the user's email (or id when there is none): no stray clicks. */
export const deleteConfirmed = (typed: string, user: { email: string | null; id: string }): boolean =>
  typed.trim().toLowerCase() === (user.email ?? user.id).toLowerCase();
