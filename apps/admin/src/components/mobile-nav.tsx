'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/** Below `lg` the sidebar lives behind a menu button in a Sheet. It closes when you pick a section. */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-2 lg:hidden">
        <SheetTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-200 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Open menu">
          <Menu aria-hidden className="h-5 w-5" />
        </SheetTrigger>
        <p className="text-base font-semibold text-neutral-50">Fuelift admin</p>
      </header>
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center justify-between">
          <SheetTitle className="text-lg font-semibold text-neutral-50">Fuelift admin</SheetTitle>
          <SheetClose className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Close menu">
            <X aria-hidden className="h-5 w-5" />
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
