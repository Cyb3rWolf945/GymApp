import { PageHeader, Table } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { revenueRows } from '@/lib/data';
import { sum, usd } from '@/lib/metrics';

export default async function PnlPage() {
  const rows = await revenueRows(30);
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.net_usd));
  const chart = [...byDay.entries()].map(([day, net]) => ({ day: day.slice(5), net: Math.round(net * 100) / 100 }));
  return (
    <>
      <PageHeader title="P&L">Revenue from Stripe balance transactions, last 30 days. Costs arrive with the cost-entries work.</PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Gross', 'gross_usd'], ['Fees', 'fees_usd'], ['Refunds', 'refunds_usd'], ['Net', 'net_usd']].map(([title, key]) => (
          <Card key={key}>
            <CardTitle>{title}</CardTitle>
            <CardValue>{usd(sum(rows.map((r) => Number(r[key as 'gross_usd']))))}</CardValue>
          </Card>
        ))}
      </div>
      <Card className="mb-6">
        <CardTitle>Net revenue per day (USD)</CardTitle>
        <BarSeries data={chart} xKey="day" yKey="net" label="Net revenue per day" />
      </Card>
      <Table
        head={['Day', 'Tier', 'Gross', 'Fees', 'Refunds', 'Net']}
        rows={rows.map((r) => [r.day, r.tier, usd(Number(r.gross_usd)), usd(Number(r.fees_usd)), usd(Number(r.refunds_usd)), usd(Number(r.net_usd))])}
      />
    </>
  );
}
