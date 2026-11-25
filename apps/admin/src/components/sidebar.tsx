'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV } from '@/lib/nav';

export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={cn('rounded-md px-3 py-2 text-sm', active ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200')}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
