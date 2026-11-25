import Link from 'next/link';
import { PageHeader } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { adInsights, aiUsageRows, costEntries, funnelBySource, priceRows, revenueRows, subscriptionRows, trialEvents } from '@/lib/data';
import { costPerTrial, margin, monthlyChurn, otherCosts, subscriptions, trialConversion } from '@/lib/kpis';
import { pct, sum, usd } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

const cents = (c: number) => usd(c / 100);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export default async function OverviewPage() {
  await requireAdmin();
  const now = new Date();
  const today = dayKey(now);
  const month = today.slice(0, 7);

  const [subs, prices, trials, revenue, ai, costs, ads, signups] = await Promise.all([
    subscriptionRows(), priceRows(), trialEvents(60), revenueRows(31), aiUsageRows(31), costEntries(), adInsights(30), funnelBySource(14),
  ]);

  const s = subscriptions(subs, prices);
  const conversion = trialConversion(trials);
  const churn = monthlyChurn(subs, now);

  const net = (rows: typeof revenue) => sum(rows.map((r) => Number(r.net_usd)));
  const since = (days: number) => dayKey(new Date(now.getTime() - days * 86_400_000));
  const net7 = net(revenue.filter((r) => r.day > since(7)));
  const net30 = net(revenue.filter((r) => r.day > since(30)));
  const netToday = net(revenue.filter((r) => r.day === today));
  const netMonth = net(revenue.filter((r) => r.day.startsWith(month)));

  const other = otherCosts(costs, now);
  const aiToday = sum(ai.filter((r) => r.day === today).map((r) => Number(r.cost_usd)));
  const aiMonth = sum(ai.filter((r) => r.day.startsWith(month)).map((r) => Number(r.cost_usd)));
  const costToday = aiToday + other.today;
  const costMonth = aiMonth + other.month;
  const mToday = margin(netToday, costToday);
  const mMonth = margin(netMonth, costMonth);

  const adSpend = sum(ads.map((a) => Number(a.spend ?? 0)));
  const adTrials = sum(ads.map((a) => Number(a.trials ?? 0)));
  const cpt = costPerTrial(adSpend, adTrials);

  const newUsers = new Map<string, number>();
  for (const r of signups) if (r.name === 'signup') newUsers.set(r.day, (newUsers.get(r.day) ?? 0) + r.events);
  const chart = [...newUsers.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, users]) => ({ day: day.slice(5), users }));

  const tile = (title: string, value: string, note?: string) => (
    <Card key={title}>
      <CardTitle>{title}</CardTitle>
      <CardValue>{value}</CardValue>
      {note ? <p className="mt-1 text-xs text-neutral-500">{note}</p> : null}
    </Card>
  );

  return (
    <>
      <PageHeader title="Overview">Subscriptions, revenue, costs and growth. List prices, no coupons: MRR is an estimate.</PageHeader>

      <h2 className="mb-3 text-sm font-medium text-neutral-400">Subscriptions</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tile('MRR', cents(s.mrrCents), `${s.paying} paying`)}
        {tile('ARPU', cents(s.arpuCents), 'MRR per paying user')}
        {tile('Active trials', String(s.trials))}
        {tile('Trial to paid', pct(conversion.rate), `${conversion.converted} of ${conversion.trials} trials, last 60 days`)}
        {(['basic', 'pro', 'elite'] as const).map((t) => tile(`${t[0].toUpperCase()}${t.slice(1)}`, String(s.byTier[t].subs), `${cents(s.byTier[t].mrrCents)} MRR`))}
        {tile('Churn this month', pct(churn.rate), `${churn.churned} ended`)}
      </div>

      <h2 className="mb-3 text-sm font-medium text-neutral-400">Money</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tile('Net revenue, 7 days', usd(net7))}
        {tile('Net revenue, 30 days', usd(net30))}
        {tile("Today: net vs cost", `${usd(netToday)} / ${usd(costToday)}`, `Margin ${usd(mToday.profit)} (${pct(mToday.pct)})`)}
        {tile('This month: net vs cost', `${usd(netMonth)} / ${usd(costMonth)}`, `Margin ${usd(mMonth.profit)} (${pct(mMonth.pct)})`)}
        {tile('Ad spend, 30 days', usd(adSpend))}
        {tile('Cost per trial', cpt === null ? '–' : usd(cpt), `${adTrials} trials from ads`)}
      </div>
      <p className="mb-6 text-sm text-neutral-400">
        Cost = AI calls + other costs. <Link href="/pnl" className="text-emerald-400 hover:underline">See the P&amp;L</Link>.
      </p>

      <Card>
        <CardTitle>New users per day (last 14 days)</CardTitle>
        <BarSeries data={chart} xKey="day" yKey="users" label="New users per day" />
      </Card>
    </>
  );
}
