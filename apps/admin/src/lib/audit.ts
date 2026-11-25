// `admin_audit_log` entries. Every view of a user's health data and every admin action writes one.

export const AUDIT_ACTIONS = [
  'admin_login',
  'mfa_enrolled',
  'mfa_verified',
  'view_user_list',
  'view_user_health',
  'admin_action',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  adminId: string;
  action: AuditAction;
  /** What was touched: `user:<id>`, a page path, … Never the data itself. */
  target?: string;
  /** Small, non-sensitive context (counts, filters). Health data never goes in here. */
  details?: Record<string, string | number | boolean | null>;
}

export function auditRow(e: AuditEntry) {
  return { admin_id: e.adminId, action: e.action, target: e.target ?? null, details: e.details ?? null };
}
