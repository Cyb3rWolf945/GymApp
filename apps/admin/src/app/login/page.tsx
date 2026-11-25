import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { signIn } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-6">
      <Card className="w-full space-y-4">
        <h1 className="text-xl font-semibold text-neutral-50">Admin sign in</h1>
        <form action={signIn} className="space-y-3">
          <Input name="email" type="email" autoComplete="username" placeholder="Email" required aria-label="Email" />
          <Input name="password" type="password" autoComplete="current-password" placeholder="Password" required aria-label="Password" />
          {error ? <p role="alert" className="text-sm text-red-400">Check your email and password and try again.</p> : null}
          <Button type="submit" className="w-full">Sign in</Button>
        </form>
      </Card>
    </main>
  );
}
