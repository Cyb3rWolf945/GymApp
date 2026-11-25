// Data export (GDPR access and portability). One JSON document with everything we hold about the user.

/** Tables with a `user_id` that belong in the export. A test checks this list against the real schema. */
export const EXPORT_TABLES = [
  'profiles', 'entitlements', 'consent_records', 'body_metrics',
  'workout_plans', 'workout_days', 'planned_exercises', 'workout_sessions', 'set_logs', 'plan_swaps',
  'nutrition_plans', 'meals', 'meal_swaps', 'shopping_list_items',
  'generation_jobs', 'memory_facts', 'push_tokens', 'guardrail_events', 'analytics_events', 'ai_call_logs',
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

/** Columns that never go in the export: Stripe ids and similar internals are not the user's data. */
export const EXPORT_HIDE_COLUMNS: Partial<Record<ExportTable, readonly string[]>> = {
  entitlements: ['stripe_customer_id', 'stripe_subscription_id'],
};

export interface UserExport {
  exportedAt: string;
  userId: string;
  email: string | null;
  data: Record<string, unknown[]>;
}

export function buildExport(userId: string, email: string | null, tables: Record<string, unknown[] | null>, now = new Date()): UserExport {
  const data: Record<string, unknown[]> = {};
  for (const t of EXPORT_TABLES) {
    const hidden = EXPORT_HIDE_COLUMNS[t] ?? [];
    data[t] = (tables[t] ?? []).map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>).filter(([k]) => !hidden.includes(k))));
  }
  return { exportedAt: now.toISOString(), userId, email, data };
}
