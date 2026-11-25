// Offline-tolerant writes: every write is queued locally first, then flushed in order.
// Rows carry client-generated ids, so a retry after a half-finished flush is an idempotent upsert.

export type OutboxTable = 'workout_sessions' | 'set_logs';

export interface OutboxItem {
  /** Row id (client-generated uuid), also the dedupe key. */
  id: string;
  table: OutboxTable;
  row: Record<string, unknown>;
}

/** Add or replace by (table, id): re-queueing the same row keeps only the latest version. */
export function enqueue(queue: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  const i = queue.findIndex((q) => q.table === item.table && q.id === item.id);
  if (i < 0) return [...queue, item];
  const next = [...queue];
  next[i] = item;
  return next;
}

/** Sessions go before their sets (foreign key); order inside each table is kept. */
export function inSyncOrder(queue: readonly OutboxItem[]): OutboxItem[] {
  const rank = (t: OutboxTable) => (t === 'workout_sessions' ? 0 : 1);
  return [...queue].sort((a, b) => rank(a.table) - rank(b.table));
}

/**
 * Send items one by one. Stops at the first failure (offline, server down) and returns what is left,
 * so nothing is lost and order is preserved. `send` returns true when the row was stored.
 */
export async function flushOutbox(
  queue: readonly OutboxItem[],
  send: (item: OutboxItem) => Promise<boolean>,
): Promise<OutboxItem[]> {
  const ordered = inSyncOrder(queue);
  for (let i = 0; i < ordered.length; i++) {
    const ok = await send(ordered[i]).catch(() => false);
    if (!ok) return ordered.slice(i);
  }
  return [];
}
