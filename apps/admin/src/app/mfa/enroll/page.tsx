import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requireAdminForMfa } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { confirmEnrollment } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EnrollPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdminForMfa();
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Enrolment is for the first login only: with a verified factor, a new one needs a code from the old one.
  if ((factors?.totp ?? []).some((f) => f.status === 'verified')) redirect('/mfa/verify');
  // Drop abandoned, never-verified factors, then start a fresh one.
  for (const f of factors?.all ?? []) if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `admin-${Date.now()}` });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-6">
      <Card className="w-full space-y-4">
        <h1 className="text-xl font-semibold text-neutral-50">Set up two-factor sign-in</h1>
        {enrollError || !data ? (
          <p role="alert" className="text-sm text-red-400">Couldn&apos;t start setup. Reload to try again.</p>
        ) : (
          <>
            <p className="text-sm text-neutral-400">Scan this code with an authenticator app, then enter the 6-digit code.</p>
            <img src={data.totp.qr_code} alt="QR code for your authenticator app" width={192} height={192} className="rounded bg-white p-2" />
            <p className="break-all text-xs text-neutral-500">Can&apos;t scan? Enter this key: {data.totp.secret}</p>
            <form action={confirmEnrollment} className="space-y-3">
              <input type="hidden" name="factorId" value={data.id} />
              <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required aria-label="6-digit code" />
              {error ? <p role="alert" className="text-sm text-red-400">That code didn&apos;t work. Try again.</p> : null}
              <Button type="submit" className="w-full">Confirm</Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
