import { PageHeader, Table } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Card, CardTitle } from '@/components/ui/card';
import { aiUsageRows } from '@/lib/data';
import { usd } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

export default async function AiHealthPage() {
  await requireAdmin();
  const rows = await aiUsageRows(30);
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.cost_usd));
  const chart = [...byDay.entries()].map(([day, cost]) => ({ day: day.slice(5), cost: Math.round(cost * 10000) / 10000 }));
  return (
    <>
      <PageHeader title="AI health">Calls, cost, latency, errors, escalations, refusals and QA failures per day, model and role.</PageHeader>
      <Card className="mb-6">
        <CardTitle>AI cost per day (USD)</CardTitle>
        <BarSeries data={chart} xKey="day" yKey="cost" label="AI cost per day" />
      </Card>
      <Table
        head={['Day', 'Role', 'Model', 'Calls', 'Cost', 'Avg ms', 'Errors', 'Escalated', 'Refusals', 'QA fails', 'Retried']}
        rows={rows.map((r) => [r.day, r.role, r.model, r.calls, usd(Number(r.cost_usd)), r.avg_latency_ms, r.errors, r.escalated_calls, r.refusals, r.qa_fails, r.retried_calls])}
      />
    </>
  );
}
