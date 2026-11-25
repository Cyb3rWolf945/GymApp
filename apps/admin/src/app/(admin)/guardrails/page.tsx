import Link from 'next/link';
import { PageHeader } from '@/components/page';
import { BarSeries } from '@/components/chart';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { guardrailQueue, guardrailRows } from '@/lib/data';
import { audit, requireAdmin } from '@/lib/session';
import { ACTION_LABELS, GUARDRAIL_LABELS } from '@/lib/userview';
import { reviewGuardrail } from './actions';

export default async function GuardrailsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admin = await requireAdmin();
  const { error } = await searchParams;

  // The queue shows what users typed, which can be health data: the audit row comes first.
  await audit({ adminId: admin.id, action: 'view_guardrail_queue', target: '/guardrails' });
  const [queue, rows] = await Promise.all([guardrailQueue(100), guardrailRows(30)]);

  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.events);
  const chart = [...byDay.entries()].map(([day, events]) => ({ day: day.slice(5), events }));

  return (
    <>
      <PageHeader title="Guardrails">
        Inputs the filter blocked, waiting for a decision. The text is shown only for review and is removed after you decide (or after 30 days).
      </PageHeader>
      {error ? <p role="alert" className="mb-4 rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">Couldn&apos;t save that decision. Try again.</p> : null}

      <Card className="mb-8">
        <CardTitle>Guardrail attempts per day (last 30 days)</CardTitle>
        <BarSeries data={chart} xKey="day" yKey="events" label="Guardrail events per day" />
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-neutral-50">Review queue ({queue.length})</h2>
      {queue.length === 0 ? <p className="text-neutral-400">Nothing to review.</p> : null}
      <ul className="space-y-4">
        {queue.map((e) => (
          <li key={e.id}>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
                <span className="font-medium text-neutral-100">{GUARDRAIL_LABELS[e.rule] ?? e.rule}</span>
                <span>Decision: {ACTION_LABELS[e.action] ?? e.action}</span>
                <span>Field: {e.field ?? '–'}</span>
                <span>{e.created_at.slice(0, 16).replace('T', ' ')}</span>
                {e.user_id ? <Link href={`/users/${e.user_id}`} className="text-emerald-400 hover:underline">User</Link> : null}
              </div>
              <blockquote className="whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200">{e.input_text}</blockquote>
              <form action={reviewGuardrail} className="flex flex-wrap gap-3">
                <input type="hidden" name="eventId" value={e.id} />
                <Button type="submit" name="decision" value="approved" variant="secondary">Approve</Button>
                <Button type="submit" name="decision" value="kept_blocked" variant="secondary">Keep blocked</Button>
                <Button type="submit" name="decision" value="contacted" variant="ghost">Contact user</Button>
              </form>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
