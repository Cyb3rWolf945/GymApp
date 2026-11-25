import { PageHeader, Table } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Card, CardTitle } from '@/components/ui/card';
import { funnelRows } from '@/lib/data';
import { funnelSteps, pct } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

export default async function FunnelPage() {
  await requireAdmin();
  const steps = funnelSteps(await funnelRows(30));
  return (
    <>
      <PageHeader title="Funnel">Quiz to purchase, last 30 days. Visitors are summed per day, so a visitor who returns on another day counts again.</PageHeader>
      <Card className="mb-6">
        <CardTitle>Visitors per step</CardTitle>
        <BarSeries data={steps.map((s) => ({ step: s.name, visitors: s.visitors }))} xKey="step" yKey="visitors" label="Visitors per funnel step" />
      </Card>
      <Table head={['Step', 'Visitors', 'From previous step']} rows={steps.map((s) => [s.name, s.visitors, pct(s.conversion)])} />
    </>
  );
}
