import { PageHeader } from '@/components/page';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { aiUsageRows, funnelRows, guardrailRows, revenueRows } from '@/lib/data';
import { funnelSteps, sum, usd } from '@/lib/metrics';

export default async function OverviewPage() {
  const [funnel, ai, guard, revenue] = await Promise.all([funnelRows(7), aiUsageRows(7), guardrailRows(7), revenueRows(7)]);
  const steps = funnelSteps(funnel);
  const visitors = (name: string) => steps.find((s) => s.name === name)?.visitors ?? 0;
  const tiles = [
    { title: 'Quiz starts', value: String(visitors('quiz_start')) },
    { title: 'Sign-ups', value: String(visitors('signup')) },
    { title: 'Trials started', value: String(visitors('trial_start')) },
    { title: 'Purchases', value: String(visitors('purchase')) },
    { title: 'Net revenue', value: usd(sum(revenue.map((r) => Number(r.net_usd)))) },
    { title: 'AI cost', value: usd(sum(ai.map((r) => Number(r.cost_usd)))) },
    { title: 'AI calls', value: String(sum(ai.map((r) => r.calls))) },
    { title: 'Guardrail events', value: String(sum(guard.map((r) => r.events))) },
  ];
  return (
    <>
      <PageHeader title="Overview">Last 7 days.</PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.title}>
            <CardTitle>{t.title}</CardTitle>
            <CardValue>{t.value}</CardValue>
          </Card>
        ))}
      </div>
    </>
  );
}
