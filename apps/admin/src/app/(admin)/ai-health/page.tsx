import { PageHeader, Table } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { activePrompts, aiLatency, aiUsageRows, generationAttempts, generationDaily, generationUserCount } from '@/lib/data';
import { failureTypes, generationSummary } from '@/lib/kpis';
import { pct, sum, usd } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

const DAYS = 30;

export default async function AiHealthPage() {
  await requireAdmin();
  const [usage, days, attempts, latency, prompts, users] = await Promise.all([aiUsageRows(DAYS), generationDaily(DAYS), generationAttempts(DAYS), aiLatency(DAYS), activePrompts(), generationUserCount(DAYS)]);

  const g = generationSummary(days);
  const cost = sum(usage.map((r) => Number(r.cost_usd)));
  const perGeneration = g.done > 0 ? cost / g.done : null;
  const perUser = users > 0 ? cost / users : null;
  const refusals = sum(usage.map((r) => r.refusals));
  const calls = sum(usage.map((r) => r.calls));

  // Latency over the period: the busiest day's p50/p95 per role would hide spikes, so show the worst day.
  const roles = [...new Set(latency.map((l) => l.role))].sort();
  const latencyByRole = roles.map((role) => {
    const rows = latency.filter((l) => l.role === role);
    return { role, calls: sum(rows.map((r) => r.calls)), p50: Math.max(...rows.map((r) => r.p50_ms)), p95: Math.max(...rows.map((r) => r.p95_ms)) };
  });

  const costByDay = new Map<string, number>();
  for (const r of usage) costByDay.set(r.day, (costByDay.get(r.day) ?? 0) + Number(r.cost_usd));
  const costChart = [...costByDay.entries()].map(([day, c]) => ({ day: day.slice(5), cost: Math.round(c * 10000) / 10000 }));
  const genChart = days.map((d) => ({ day: d.day.slice(5), generations: d.done }));

  const tile = (title: string, value: string, note?: string) => (
    <Card key={title}>
      <CardTitle>{title}</CardTitle>
      <CardValue>{value}</CardValue>
      {note ? <p className="mt-1 text-xs text-neutral-500">{note}</p> : null}
    </Card>
  );
  const dollars = (n: number | null) => (n === null ? '–' : `$${n.toFixed(4)}`);

  return (
    <>
      <PageHeader title="AI health">Last {DAYS} days. Rates are over finished generations (a workout or a meal plan each).</PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile('Generations', String(g.done), `${g.failed} failed of ${g.jobs} started`)}
        {tile('First-pass rate', pct(g.firstPassRate), 'passed validation and QA first time')}
        {tile('Retry rate', pct(g.retryRate), 'needed more than one attempt')}
        {tile('Escalation rate', pct(g.escalationRate), 'went to the stronger model')}
        {tile('Fallback rate', pct(g.fallbackRate), 'safe template used')}
        {tile('Refusals', String(refusals), `of ${calls} model calls`)}
        {tile('Total AI cost', usd(cost))}
        {tile('Cost per generation', dollars(perGeneration))}
        {tile('Cost per user', dollars(perUser), `${users} users generated plans`)}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Generations per day</CardTitle>
          <BarSeries data={genChart} xKey="day" yKey="generations" label="Generations per day" />
        </Card>
        <Card>
          <CardTitle>AI cost per day (USD)</CardTitle>
          <BarSeries data={costChart} xKey="day" yKey="cost" label="AI cost per day" />
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Latency (worst day in the period)</h2>
      <div className="mb-8">
        <Table head={['Role', 'Calls', 'p50 (ms)', 'p95 (ms)']} rows={latencyByRole.map((l) => [l.role, l.calls, l.p50, l.p95])} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Failures by type</h2>
      <p className="mb-3 text-sm text-neutral-400">Validator problems grouped by kind, plus QA, schema and provider failures. One generation can fail several times before it passes.</p>
      <div className="mb-8">
        <Table head={['Type', 'Count']} rows={failureTypes(attempts).map((f) => [f.type, f.count])} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Active prompt versions</h2>
      <div className="mb-8">
        <Table head={['Prompt', 'Version', 'Model']} rows={prompts.map((p) => [p.name, p.version, p.model ?? 'profile default'])} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">By day, model and role</h2>
      <Table
        head={['Day', 'Role', 'Model', 'Calls', 'Cost', 'Avg ms', 'Errors', 'Escalated', 'Refusals', 'QA fails', 'Retried']}
        rows={usage.map((r) => [r.day, r.role, r.model, r.calls, usd(Number(r.cost_usd)), r.avg_latency_ms, r.errors, r.escalated_calls, r.refusals, r.qa_fails, r.retried_calls])}
      />
    </>
  );
}
