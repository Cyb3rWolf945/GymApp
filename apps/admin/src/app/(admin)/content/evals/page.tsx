import { ContentNav } from '@/components/form';
import { PageHeader, Table } from '@/components/page';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { evalRuns } from '@/lib/data';
import { evalPassRate, SUITE_LABELS } from '@/lib/evals';
import { pct } from '@/lib/metrics';
import { requireAdmin } from '@/lib/session';

export default async function EvalsPage() {
  await requireAdmin();
  const runs = await evalRuns(30);
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.suite)) latest.set(r.suite, r);

  return (
    <>
      <PageHeader title="Evals">
        Red-team and eval results. Runs are recorded with <code>pnpm eval:redteam</code> (needs the Supabase URL and service-role key). Only case ids are stored, never the test strings.
      </PageHeader>
      <ContentNav current="/content/evals" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {Object.keys(SUITE_LABELS).map((suite) => {
          const r = latest.get(suite);
          return (
            <Card key={suite}>
              <CardTitle>{SUITE_LABELS[suite]} (latest)</CardTitle>
              <CardValue>{r ? `${r.passed}/${r.total} · ${pct(evalPassRate(r.passed, r.total))}` : 'No run yet'}</CardValue>
              {r ? <p className="mt-1 text-sm text-neutral-500">{r.created_at.slice(0, 16).replace('T', ' ')} · {r.profile}</p> : null}
            </Card>
          );
        })}
      </div>

      <Table
        head={['When', 'Suite', 'Profile', 'Passed', 'Failing cases', 'Note']}
        rows={runs.map((r) => [
          r.created_at.slice(0, 16).replace('T', ' '),
          SUITE_LABELS[r.suite] ?? r.suite,
          r.profile,
          `${r.passed}/${r.total}`,
          Array.isArray(r.failures) && r.failures.length > 0 ? r.failures.join(', ') : '–',
          r.note ?? '–',
        ])}
      />
    </>
  );
}
