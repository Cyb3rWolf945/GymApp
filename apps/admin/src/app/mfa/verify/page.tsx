import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requireAdminForMfa } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { verifyCode } from '../actions';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdminForMfa();
  const { error } = await searchParams;
  const { data } = await (await createClient()).auth.mfa.listFactors();
  const factor = (data?.totp ?? []).find((f) => f.status === 'verified');
  if (!factor) redirect('/mfa/enroll');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-6">
      <Card className="w-full space-y-4">
        <h1 className="text-xl font-semibold text-neutral-50">Enter your code</h1>
        <p className="text-sm text-neutral-400">Open your authenticator app and enter the 6-digit code.</p>
        <form action={verifyCode} className="space-y-3">
          <input type="hidden" name="factorId" value={factor.id} />
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required aria-label="6-digit code" />
          {error ? <p role="alert" className="text-sm text-red-400">That code didn&apos;t work. Try again.</p> : null}
          <Button type="submit" className="w-full">Verify</Button>
        </form>
      </Card>
    </main>
  );
}
