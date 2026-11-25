import type { Tier } from './pricing.ts';

export interface BalanceTransaction {
  type: string;
  /** Cents, signed: charges positive, refunds negative. */
  amount: number;
  /** Stripe's fee in cents. */
  fee: number;
  created: number;
  /** Customer the money belongs to, resolved by the caller (expanded charge). */
  customer: string | null;
}
export interface RevenueRow {
  day: string;
  tier: Tier;
  gross_usd: number;
  fees_usd: number;
  refunds_usd: number;
}

/** Per day and tier: gross (charges), fees, refunds. Net = gross - fees - refunds, derived by readers. */
export function aggregateRevenue(txs: readonly BalanceTransaction[], tierOfCustomer: (customer: string | null) => Tier): RevenueRow[] {
  const rows = new Map<string, RevenueRow>();
  for (const t of txs) {
    const isCharge = t.type === 'charge' || t.type === 'payment';
    const isRefund = t.type === 'refund' || t.type === 'payment_refund';
    if (!isCharge && !isRefund) continue;
    const day = new Date(t.created * 1000).toISOString().slice(0, 10);
    const tier = tierOfCustomer(t.customer);
    const key = `${day}|${tier}`;
    const row = rows.get(key) ?? { day, tier, gross_usd: 0, fees_usd: 0, refunds_usd: 0 };
    if (isCharge) row.gross_usd += t.amount / 100;
    else row.refunds_usd += Math.abs(t.amount) / 100;
    row.fees_usd += t.fee / 100;
    rows.set(key, row);
  }
  return [...rows.values()].map((r) => ({ ...r, gross_usd: round2(r.gross_usd), fees_usd: round2(r.fees_usd), refunds_usd: round2(r.refunds_usd) })).sort((a, b) => a.day.localeCompare(b.day) || a.tier.localeCompare(b.tier));
}
const round2 = (n: number) => Math.round(n * 100) / 100;
