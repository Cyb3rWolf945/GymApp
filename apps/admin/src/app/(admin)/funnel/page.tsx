import { PageHeader, Table } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { funnelBySource, onboardingScreens } from '@/lib/data';
import { screenDropOff, sourceOptions } from '@/lib/kpis';
import { funnelSteps, pct } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

const PERIODS = [7, 30, 90] as const;

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ source?: string; days?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const days = (PERIODS as readonly number[]).includes(Number(params.days)) ? Number(params.days) : 30;
  // The filter value is only ever used as a query parameter value, never as SQL.
  const source = params.source?.slice(0, 80) || undefined;

  const [all, rows, screens] = await Promise.all([funnelBySource(days), funnelBySource(days, source), onboardingScreens(days, source)]);
  const steps = funnelSteps(rows);
  const drop = screenDropOff(screens);
  const sources = sourceOptions(all);

  return (
    <>
      <PageHeader title="Funnel">
        Quiz to purchase, last {days} days{source ? `, source ${source}` : ', all sources'}. Visitors are counted per day, so a visitor who returns on another day counts again.
      </PageHeader>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-neutral-400">
          Source (UTM)
          <select name="source" defaultValue={source ?? ''} className="mt-1 block h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-50">
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm text-neutral-400">
          Period
          <select name="days" defaultValue={String(days)} className="mt-1 block h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-50">
            {PERIODS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      <Card className="mb-6">
        <CardTitle>Visitors per step</CardTitle>
        <BarSeries data={steps.map((s) => ({ step: s.name, visitors: s.visitors }))} xKey="step" yKey="visitors" label="Visitors per funnel step" />
      </Card>
      <div className="mb-8">
        <Table head={['Step', 'Visitors', 'From previous step']} rows={steps.map((s) => [s.name, s.visitors, pct(s.conversion)])} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Onboarding drop-off by screen</h2>
      <Table
        head={['Screen', 'Visitors', 'Stayed from previous', 'Dropped']}
        rows={drop.map((d) => [d.screen, d.visitors, pct(d.stayed), d.stayed === null ? '–' : pct(1 - d.stayed)])}
      />
    </>
  );
}
