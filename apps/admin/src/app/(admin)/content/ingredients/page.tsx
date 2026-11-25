import Link from 'next/link';
import { CheckGroup, ContentNav, Field, SelectField, Status } from '@/components/form';
import { PageHeader, Table } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ALLERGENS, INGREDIENT_CATEGORIES } from '@/lib/content';
import { getIngredient, listIngredients } from '@/lib/data';
import { requireAdmin } from '@/lib/session';
import { deleteIngredient, saveIngredient } from '../actions';

type Search = { q?: string; edit?: string; saved?: string; error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUM = { type: 'number', step: '0.1', min: 0, required: true } as const;

export default async function IngredientsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 80);
  const [rows, editing] = await Promise.all([listIngredients(q), sp.edit && UUID.test(sp.edit) ? getIngredient(sp.edit) : Promise.resolve(null)]);

  return (
    <>
      <PageHeader title="Ingredients">Values are per 100 g. Recipes find ingredients by name, so names are unique.</PageHeader>
      <ContentNav current="/content/ingredients" />
      <Status saved={sp.saved} error={sp.error} />

      <Card className="mb-8">
        <CardTitle>{editing ? `Edit ${editing.name}` : 'New ingredient'}</CardTitle>
        <form action={saveIngredient} className="mt-3 grid gap-4 sm:grid-cols-2">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Field label="Name"><Input name="name" required defaultValue={editing?.name} /></Field>
          <Field label="Category"><SelectField name="category" options={INGREDIENT_CATEGORIES} value={editing?.category} placeholder="Pick…" /></Field>
          <Field label="Calories (kcal)"><Input name="kcal_per_100g" {...NUM} defaultValue={editing?.kcal_per_100g ?? ''} /></Field>
          <Field label="Protein (g)"><Input name="protein_per_100g" {...NUM} defaultValue={editing?.protein_per_100g ?? ''} /></Field>
          <Field label="Carbs (g)"><Input name="carbs_per_100g" {...NUM} defaultValue={editing?.carbs_per_100g ?? ''} /></Field>
          <Field label="Fat (g)"><Input name="fat_per_100g" {...NUM} defaultValue={editing?.fat_per_100g ?? ''} /></Field>
          <div className="sm:col-span-2"><Field label="Allergens"><CheckGroup name="allergens" options={ALLERGENS} values={editing?.allergens} /></Field></div>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{editing ? 'Save changes' : 'Add ingredient'}</Button>
            {editing ? <Button asChild variant="ghost"><Link href="/content/ingredients">Cancel</Link></Button> : null}
          </div>
        </form>
      </Card>

      <form method="get" className="mb-4 flex gap-3">
        <Input name="q" placeholder="Search by name" defaultValue={q} className="max-w-xs" aria-label="Search ingredients" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Table
        head={['Name', 'Category', 'kcal', 'P / C / F (g)', 'Allergens', '']}
        rows={rows.map((r) => [
          r.name, (r.category ?? '–').replace(/_/g, ' '), r.kcal_per_100g ?? '–',
          `${r.protein_per_100g ?? '–'} / ${r.carbs_per_100g ?? '–'} / ${r.fat_per_100g ?? '–'}`, r.allergens.join(', ') || '–',
          <div key={r.id} className="flex gap-2">
            <Button asChild size="sm" variant="secondary"><Link href={`/content/ingredients?edit=${r.id}`}>Edit</Link></Button>
            <form action={deleteIngredient}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="sm" variant="ghost">Delete</Button></form>
          </div>,
        ])}
      />
    </>
  );
}
