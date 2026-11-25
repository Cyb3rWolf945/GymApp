import Link from 'next/link';
import { ContentNav, Field, Status, fieldClass } from '@/components/form';
import { PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { promptVersions } from '@/lib/data';
import { diffLines, diffStats } from '@/lib/promptdiff';
import { requireAdmin } from '@/lib/session';
import { activatePromptVersion, createPromptVersion } from '../actions';

type Search = { name?: string; a?: string; b?: string; from?: string; saved?: string; error?: string };

export default async function PromptsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const all = await promptVersions();
  const names = [...new Set(all.map((p) => p.name))];
  const byId = new Map(all.map((p) => [p.id, p]));

  // Compare two versions: the ones picked in the URL, otherwise the newest against the active one.
  const a = byId.get(sp.a ?? '');
  const b = byId.get(sp.b ?? '');
  const diff = a && b ? diffLines(a.body, b.body) : null;
  const stats = diff ? diffStats(diff) : null;
  const template = byId.get(sp.from ?? '');

  return (
    <>
      <PageHeader title="Prompts">
        Versions of each prompt. Only one version per prompt is active. New versions start inactive; activating one is a separate step and is audited.
      </PageHeader>
      <ContentNav current="/content/prompts" />
      <Status saved={sp.saved} error={sp.error} />

      {names.length === 0 ? <p className="mb-8 text-neutral-400">No prompt versions yet. Add the first one below.</p> : null}
      {names.map((name) => {
        const versions = all.filter((p) => p.name === name);
        const active = versions.find((v) => v.active);
        return (
          <Card key={name} className="mb-6">
            <CardTitle>{name}{active ? ` — active: v${active.version}` : ' — no active version'}</CardTitle>
            <ul className="mt-3 space-y-3">
              {versions.map((v) => (
                <li key={v.id} className="rounded-md border border-neutral-800 p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-300">
                    <span className="font-medium text-neutral-50">v{v.version}</span>
                    {v.active ? <span className="rounded bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">Active</span> : null}
                    <span className="text-neutral-500">{v.created_at.slice(0, 16).replace('T', ' ')}</span>
                    {v.model ? <span className="text-neutral-500">{v.model}</span> : null}
                    <span className="ml-auto flex gap-2">
                      {active && active.id !== v.id ? (
                        <Button asChild size="sm" variant="ghost"><Link href={`/content/prompts?a=${active.id}&b=${v.id}`}>Compare with active</Link></Button>
                      ) : null}
                      <Button asChild size="sm" variant="ghost"><Link href={`/content/prompts?from=${v.id}#new`}>Use as template</Link></Button>
                      {!v.active ? (
                        <form action={activatePromptVersion}><input type="hidden" name="id" value={v.id} /><Button type="submit" size="sm" variant="secondary">Activate</Button></form>
                      ) : null}
                    </span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-neutral-400">Show text</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200">{v.body}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      {diff && a && b ? (
        <Card className="mb-8">
          <CardTitle>{a.name}: v{a.version} → v{b.version} (+{stats!.added} −{stats!.removed})</CardTitle>
          <pre aria-label="Differences between the two versions" className="mt-3 overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs">
            {diff.map((l, i) => (
              <div key={i} className={l.kind === 'added' ? 'bg-emerald-950 text-emerald-300' : l.kind === 'removed' ? 'bg-red-950 text-red-300' : 'text-neutral-400'}>
                {l.kind === 'added' ? '+ ' : l.kind === 'removed' ? '− ' : '  '}{l.text}
              </div>
            ))}
          </pre>
        </Card>
      ) : null}

      <Card id="new">
        <CardTitle>New version</CardTitle>
        <form action={createPromptVersion} className="mt-3 grid gap-4">
          <Field label="Prompt name" hint="Lowercase letters, digits and underscores. An existing name adds a new version.">
            <Input name="name" required defaultValue={template?.name ?? ''} list="prompt-names" />
            <datalist id="prompt-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="Model (optional)"><Input name="model" defaultValue={template?.model ?? ''} /></Field>
          <Field label="Text"><textarea name="body" rows={12} required defaultValue={template?.body ?? ''} className={`${fieldClass} font-mono`} /></Field>
          <div><Button type="submit">Save as new version</Button></div>
        </form>
      </Card>
    </>
  );
}
