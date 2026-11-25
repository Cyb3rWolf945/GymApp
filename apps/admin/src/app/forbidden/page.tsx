import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function signOut() {
  'use server';
  await (await createClient()).auth.signOut();
  redirect('/login');
}

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-6">
      <Card className="w-full space-y-4">
        <h1 className="text-xl font-semibold text-neutral-50">No access</h1>
        <p className="text-sm text-neutral-400">This account is not an admin. Sign in with another account.</p>
        <form action={signOut}>
          <Button type="submit" variant="secondary">Sign out</Button>
        </form>
      </Card>
    </main>
  );
}
