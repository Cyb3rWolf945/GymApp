import type { ReactNode } from 'react';
import Link from 'next/link';

export const fieldClass = 'mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-emerald-400';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-neutral-300">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs text-neutral-500">{hint}</span> : null}
    </label>
  );
}

/** A single choice list. `value` is the current value when editing. */
export function SelectField({ name, options, value, placeholder }: { name: string; options: readonly string[]; value?: string | null; placeholder?: string }) {
  return (
    <select name={name} defaultValue={value ?? ''} className={fieldClass}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
    </select>
  );
}

/** Several choices as checkboxes (all share one form field name). */
export function CheckGroup({ name, options, values }: { name: string; options: readonly string[]; values?: readonly string[] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input type="checkbox" name={name} value={o} defaultChecked={values?.includes(o)} className="h-4 w-4 accent-emerald-500" />
          {o.replace(/_/g, ' ')}
        </label>
      ))}
    </div>
  );
}

export function Status({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <p role="alert" className="mb-4 rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p>;
  if (saved) return <p role="status" className="mb-4 rounded-md border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-300">Saved.</p>;
  return null;
}

const SECTIONS = [
  ['/content', 'Overview'], ['/content/exercises', 'Exercises'], ['/content/recipes', 'Recipes'], ['/content/ingredients', 'Ingredients'],
  ['/content/prompts', 'Prompts'], ['/content/evals', 'Evals'],
] as const;

export function ContentNav({ current }: { current: string }) {
  return (
    <nav aria-label="Content sections" className="mb-6 flex flex-wrap gap-2 text-sm">
      {SECTIONS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}
          className={`rounded-md px-3 py-1.5 ${href === current ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-400 hover:bg-neutral-900'}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
