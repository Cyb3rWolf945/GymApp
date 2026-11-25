import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-neutral-50">{title}</h1>
      {children ? <p className="mt-1 text-sm text-neutral-400">{children}</p> : null}
    </header>
  );
}

/** On small screens the table scrolls inside its card and the first column (name, email, step) stays in view. */
const STICKY = 'sticky left-0 z-10 border-r border-neutral-800';

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-900 text-neutral-400">
          <tr>{head.map((h, i) => <th key={h} className={`px-4 py-2 font-medium ${i === 0 ? STICKY + ' bg-neutral-900' : ''}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} className="px-4 py-6 text-neutral-500">No data yet.</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-neutral-800">{r.map((c, j) => <td key={j} className={`px-4 py-2 ${j === 0 ? STICKY + ' bg-neutral-950' : ''}`}>{c}</td>)}</tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
