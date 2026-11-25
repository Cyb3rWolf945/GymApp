// Offline-tolerant writes: every write is queued locally first, then flushed in order.
// Rows carry client-generated ids, so a retry after a half-finished flush is an idempotent upsert.

export type OutboxTable = 'workout_sessions' | 'set_logs';

export interface OutboxItem {
  /** Row id (client-generated uuid), also the dedupe key. */
  id: string;
  table: OutboxTable;
  row: Record<string, unknown>;
  /** `upsert` (default): store the row. `delete`: remove the stored row with this id (a correction made in History). */
  op?: 'upsert' | 'delete';
}

/** Add or replace by (table, id): re-queueing the same row keeps only the latest version (a delete replaces an earlier edit of the same row). */
export function enqueue(queue: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  const i = queue.findIndex((q) => q.table === item.table && q.id === item.id);
  if (i < 0) return [...queue, item];
  const next = [...queue];
  next[i] = item;
  return next;
}

/**
 * Writes go before deletes. Among writes, sessions go before their sets (foreign key); among deletes, sets go before
 * their session. Order inside each group is kept.
 */
export function inSyncOrder(queue: readonly OutboxItem[]): OutboxItem[] {
  const rank = (i: OutboxItem) => (i.op === 'delete' ? (i.table === 'set_logs' ? 2 : 3) : i.table === 'workout_sessions' ? 0 : 1);
  return [...queue].sort((a, b) => rank(a) - rank(b));
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
