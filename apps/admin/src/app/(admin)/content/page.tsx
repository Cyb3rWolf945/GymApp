import Link from 'next/link';
import { ContentNav } from '@/components/form';
import { PageHeader } from '@/components/page';
import { Card, CardTitle } from '@/components/ui/card';
import { evalRuns, listExercises, listIngredients, listRecipes, promptVersions } from '@/lib/data';
import { requireAdmin } from '@/lib/session';

export default async function ContentPage() {
  await requireAdmin();
  const [ex, rc, ing, prompts, evals] = await Promise.all([listExercises(), listRecipes(), listIngredients(), promptVersions(), evalRuns(1)]);
  const items = [
    { href: '/content/exercises', title: 'Exercises', n: `${ex.length}${ex.length >= 200 ? '+' : ''}`, text: 'The library the planner picks from. Slug, equipment, level, muscles and contraindications.' },
    { href: '/content/recipes', title: 'Recipes', n: `${rc.length}${rc.length >= 200 ? '+' : ''}`, text: 'Meals the planner picks from. Macros are computed from the ingredients.' },
    { href: '/content/ingredients', title: 'Ingredients', n: `${ing.length}${ing.length >= 200 ? '+' : ''}`, text: 'Nutrition per 100 g and allergens. Allergens are a hard rule in plans.' },
    { href: '/content/prompts', title: 'Prompts', n: String(new Set(prompts.map((p) => p.name)).size), text: 'Versions, differences between versions, and which one is active.' },
    { href: '/content/evals', title: 'Evals', n: evals[0] ? `${evals[0].passed}/${evals[0].total}` : '–', text: 'Results of red-team and eval runs (latest shown).' },
  ];
  return (
    <>
      <PageHeader title="Content">Edit what the apps and the planner use. Every change is written to the audit log.</PageHeader>
      <ContentNav current="/content" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="block focus-visible:outline-2 focus-visible:outline-emerald-400">
            <Card className="h-full hover:border-neutral-600">
              <CardTitle>{i.title}</CardTitle>
              <p className="mt-1 text-2xl font-semibold text-neutral-50">{i.n}</p>
              <p className="mt-2 text-sm text-neutral-400">{i.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
