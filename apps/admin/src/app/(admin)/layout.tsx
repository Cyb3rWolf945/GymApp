import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { MobileNav } from '@/components/mobile-nav';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function signOut() {
  'use server';
  await (await createClient()).auth.signOut();
  redirect('/login');
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const account = (
    <form action={signOut} className="mt-8">
      <p className="mb-2 truncate text-xs text-neutral-500">{admin.email}</p>
      <Button variant="ghost" size="sm" type="submit">Sign out</Button>
    </form>
  );
  return (
    <div className="min-h-screen">
      {/* Below lg: a menu button and a Sheet. From lg: the fixed sidebar. */}
      <MobileNav>
        <Sidebar />
        {account}
      </MobileNav>
      <div className="mx-auto flex max-w-7xl gap-8 p-4 sm:p-6">
        <aside className="hidden w-48 shrink-0 lg:block">
          <p className="mb-6 text-lg font-semibold text-neutral-50">Fuelift admin</p>
          <Sidebar />
          {account}
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
