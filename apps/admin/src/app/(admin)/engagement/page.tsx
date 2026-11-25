import { BarSeries } from '@/components/chart';
import { PageHeader, Table } from '@/components/page';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { engagementAdherence, engagementDaily, retentionCohorts, topSwaps } from '@/lib/data';
import { adherenceLabel, overallRetention, retentionRate, summarizeEngagement } from '@/lib/engagement';
import { pct } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

export default async function EngagementPage() {
  await requireAdmin();
  const [daily, adherence, cohorts, swaps] = await Promise.all([engagementDaily(30), engagementAdherence(28), retentionCohorts(60), topSwaps(10)]);
  const summary = summarizeEngagement(daily);
  const retention = overallRetention(cohorts);
  const chart = daily.map((r) => ({ day: r.day.slice(5), dau: r.dau, workouts: r.workouts }));

  return (
    <>
      <PageHeader title="Engagement">
        Aggregates only, no individual users. A user is active on a day if they started a workout or did something in the app (UTC days).
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardTitle>DAU (today)</CardTitle><CardValue>{summary.dau}</CardValue></Card>
        <Card><CardTitle>WAU (last 7 days)</CardTitle><CardValue>{summary.wau}</CardValue></Card>
        <Card><CardTitle>Workouts per day (30 days)</CardTitle><CardValue>{summary.workoutsPerDay}</CardValue></Card>
        <Card><CardTitle>Average adherence (28 days)</CardTitle><CardValue>{adherenceLabel(adherence.avgPct, adherence.users)}</CardValue></Card>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Adherence compares finished workouts with the days per week each user asked for, capped at 100%, for users who have been here at least a week.
        {summary.stickiness !== null ? ` DAU ÷ WAU today: ${pct(summary.stickiness)}.` : ''}
      </p>

      <Card className="mb-6">
        <CardTitle>Daily active users (last 30 days)</CardTitle>
        <BarSeries data={chart} xKey="day" yKey="dau" label="Daily active users" />
      </Card>
      <Card className="mb-8">
        <CardTitle>Workouts finished per day (last 30 days)</CardTitle>
        <BarSeries data={chart} xKey="day" yKey="workouts" label="Workouts finished per day" />
      </Card>

      <h2 className="mb-1 text-lg font-semibold text-neutral-50">Retention by signup day</h2>
      <p className="mb-3 text-sm text-neutral-400">
        Share of each signup day that was active exactly 1, 7 and 30 days later. Overall (weighted by cohort size): D1 {pct(retention.d1)}, D7 {pct(retention.d7)}, D30 {pct(retention.d30)}. A dash means that day has not been reached yet.
      </p>
      <div className="mb-8">
        <Table
          head={['Signup day', 'Users', 'D1', 'D7', 'D30']}
          rows={cohorts.slice(0, 30).map((c) => [c.cohort, c.size, pct(retentionRate(c.d1, c.size)), pct(retentionRate(c.d7, c.size)), pct(retentionRate(c.d30, c.size))])}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-50">Most swapped exercises</h2>
          <Table head={['Exercise', 'Swaps']} rows={swaps.filter((s) => s.kind === 'exercise').map((s) => [s.name, s.swaps])} />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-50">Most swapped meals</h2>
          <Table head={['Meal', 'Swaps']} rows={swaps.filter((s) => s.kind === 'meal').map((s) => [s.name, s.swaps])} />
        </div>
      </div>
    </>
  );
}
