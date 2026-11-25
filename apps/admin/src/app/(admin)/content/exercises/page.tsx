import Link from 'next/link';
import { CheckGroup, ContentNav, Field, SelectField, Status, fieldClass } from '@/components/form';
import { PageHeader, Table } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CONTRAINDICATIONS, EQUIPMENT, EXERCISE_LEVELS, MUSCLE_IDS } from '@/lib/content';
import { getExercise, listExercises } from '@/lib/data';
import { requireAdmin } from '@/lib/session';
import { deleteExercise, saveExercise } from '../actions';

type Search = { q?: string; edit?: string; saved?: string; error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 80);
  const [rows, editing] = await Promise.all([listExercises(q), sp.edit && UUID.test(sp.edit) ? getExercise(sp.edit) : Promise.resolve(null)]);

  return (
    <>
      <PageHeader title="Exercises">The slug is what plans and logs refer to: keep it stable.</PageHeader>
      <ContentNav current="/content/exercises" />
      <Status saved={sp.saved} error={sp.error} />

      <Card className="mb-8">
        <CardTitle>{editing ? `Edit ${editing.name}` : 'New exercise'}</CardTitle>
        <form action={saveExercise} className="mt-3 grid gap-4 sm:grid-cols-2">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Field label="Name"><Input name="name" required defaultValue={editing?.name} /></Field>
          <Field label="Slug" hint="Leave empty to make it from the name."><Input name="slug" defaultValue={editing?.slug} /></Field>
          <Field label="Equipment"><SelectField name="equipment" options={EQUIPMENT} value={editing?.equipment} placeholder="Pick…" /></Field>
          <Field label="Level"><SelectField name="level" options={EXERCISE_LEVELS} value={editing?.level} placeholder="Pick…" /></Field>
          <Field label="Mechanic (optional)"><Input name="mechanic" defaultValue={editing?.mechanic ?? ''} /></Field>
          <div className="sm:col-span-2"><Field label="Primary muscles"><CheckGroup name="primary" options={MUSCLE_IDS} values={editing?.primary} /></Field></div>
          <div className="sm:col-span-2"><Field label="Secondary muscles"><CheckGroup name="secondary" options={MUSCLE_IDS} values={editing?.secondary} /></Field></div>
          <div className="sm:col-span-2"><Field label="Not suitable with an injury at"><CheckGroup name="contraindications" options={CONTRAINDICATIONS} values={editing?.contraindications} /></Field></div>
          <div className="sm:col-span-2"><Field label="Instructions"><textarea name="instructions" rows={4} defaultValue={editing?.instructions ?? ''} className={fieldClass} /></Field></div>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{editing ? 'Save changes' : 'Add exercise'}</Button>
            {editing ? <Button asChild variant="ghost"><Link href="/content/exercises">Cancel</Link></Button> : null}
          </div>
        </form>
      </Card>

      <form method="get" className="mb-4 flex gap-3">
        <Input name="q" placeholder="Search by name" defaultValue={q} className="max-w-xs" aria-label="Search exercises" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Table
        head={['Name', 'Slug', 'Equipment', 'Level', '']}
        rows={rows.map((r) => [
          r.name, r.slug, (r.equipment ?? '–').replace(/_/g, ' '), r.level,
          <div key={r.id} className="flex gap-2">
            <Button asChild size="sm" variant="secondary"><Link href={`/content/exercises?edit=${r.id}`}>Edit</Link></Button>
            <form action={deleteExercise}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="sm" variant="ghost">Delete</Button></form>
          </div>,
        ])}
      />
    </>
  );
}
