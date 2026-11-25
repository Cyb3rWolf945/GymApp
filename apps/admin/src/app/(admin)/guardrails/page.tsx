import { PageHeader, Table } from '@/components/page';
import { guardrailRows } from '@/lib/data';
import { requireAdmin } from '@/lib/session';

export default async function GuardrailsPage() {
  await requireAdmin();
  const rows = await guardrailRows(30);
  return (
    <>
      <PageHeader title="Guardrails">Decisions per day, field, category and action, last 30 days. User text is kept only for the review queue and removed after 30 days.</PageHeader>
      <Table head={['Day', 'Field', 'Category', 'Action', 'Events']} rows={rows.map((r) => [r.day, r.field ?? '–', r.category, r.action, r.events])} />
    </>
  );
}
