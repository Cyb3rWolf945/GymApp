// What goes in a user's data export. A copy of `EXPORT_TABLES` in packages/shared (the admin app does not import the
// shared package); a test fails if the two lists differ.
export const EXPORT_TABLES = [
  'profiles', 'entitlements', 'consent_records', 'body_metrics', 'weekly_checkins',
  'workout_plans', 'workout_days', 'planned_exercises', 'workout_sessions', 'set_logs', 'plan_swaps',
  'nutrition_plans', 'meals', 'meal_swaps', 'shopping_list_items',
  'generation_jobs', 'memory_facts', 'push_tokens', 'guardrail_events', 'analytics_events', 'ai_call_logs',
] as const;

/** Stripe ids are not the user's data. */
export const HIDDEN_COLUMNS: Record<string, readonly string[]> = { entitlements: ['stripe_customer_id', 'stripe_subscription_id'] };

export function buildExport(userId: string, email: string | null, tables: Record<string, unknown[] | null>, now = new Date()) {
  const data: Record<string, unknown[]> = {};
  for (const t of EXPORT_TABLES) {
    const hidden = HIDDEN_COLUMNS[t] ?? [];
    data[t] = (tables[t] ?? []).map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>).filter(([k]) => !hidden.includes(k))));
  }
  return { exportedAt: now.toISOString(), userId, email, data };
}
