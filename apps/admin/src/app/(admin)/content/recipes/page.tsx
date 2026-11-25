import Link from 'next/link';
import { ContentNav, Field, SelectField, Status, fieldClass } from '@/components/form';
import { PageHeader, Table } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DIETS } from '@/lib/content';
import { getRecipe, listRecipes } from '@/lib/data';
import { requireAdmin } from '@/lib/session';
import { deleteRecipe, saveRecipe } from '../actions';

type Search = { q?: string; edit?: string; saved?: string; error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 80);
  const [rows, editing] = await Promise.all([listRecipes(q), sp.edit && UUID.test(sp.edit) ? getRecipe(sp.edit) : Promise.resolve(null)]);

  return (
    <>
      <PageHeader title="Recipes">Calories and macros per serving are worked out from the ingredient lines when you save.</PageHeader>
      <ContentNav current="/content/recipes" />
      <Status saved={sp.saved} error={sp.error} />

      <Card className="mb-8">
        <CardTitle>{editing ? `Edit ${editing.name}` : 'New recipe'}</CardTitle>
        <form action={saveRecipe} className="mt-3 grid gap-4 sm:grid-cols-2">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Field label="Name"><Input name="name" required defaultValue={editing?.name} /></Field>
          <Field label="Slug" hint="Leave empty to make it from the name."><Input name="slug" defaultValue={editing?.slug} /></Field>
          <Field label="Diet"><SelectField name="diet" options={DIETS} value={editing?.diet} placeholder="Pick…" /></Field>
          <Field label="Servings"><Input name="servings" type="number" min={1} max={12} step={1} required defaultValue={editing?.servings ?? 1} /></Field>
          <div className="sm:col-span-2">
            <Field label="Ingredients" hint='One per line: "ingredient name, grams". Names must match an ingredient exactly (not case sensitive).'>
              <textarea name="ingredients" rows={6} required defaultValue={editing?.lines ?? ''} className={fieldClass} placeholder={'Oats, 80\nWhole milk, 200'} />
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Instructions"><textarea name="instructions" rows={4} defaultValue={editing?.instructions ?? ''} className={fieldClass} /></Field></div>
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{editing ? 'Save changes' : 'Add recipe'}</Button>
            {editing ? <Button asChild variant="ghost"><Link href="/content/recipes">Cancel</Link></Button> : null}
          </div>
        </form>
      </Card>

      <form method="get" className="mb-4 flex gap-3">
        <Input name="q" placeholder="Search by name" defaultValue={q} className="max-w-xs" aria-label="Search recipes" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Table
        head={['Name', 'Diet', 'Servings', 'kcal', 'P / C / F (g)', '']}
        rows={rows.map((r) => [
          r.name, r.diet, r.servings, r.kcal ?? '–', `${r.protein_g ?? '–'} / ${r.carbs_g ?? '–'} / ${r.fat_g ?? '–'}`,
          <div key={r.id} className="flex gap-2">
            <Button asChild size="sm" variant="secondary"><Link href={`/content/recipes?edit=${r.id}`}>Edit</Link></Button>
            <form action={deleteRecipe}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="sm" variant="ghost">Delete</Button></form>
          </div>,
        ])}
      />
    </>
  );
}
