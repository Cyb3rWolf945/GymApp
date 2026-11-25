import Link from 'next/link';
import { PageHeader, Table } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userList } from '@/lib/data';
import { audit, requireAdmin } from '@/lib/session';
import { cleanSearch, maskEmail } from '@/lib/users';

const PAGE_SIZE = 50;
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : '–');

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; deleted?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = cleanSearch(params.q);
  const page = Math.max(0, Number.parseInt(params.page ?? '0', 10) || 0);
  const users = await userList(q, page, PAGE_SIZE);
  // Listing and searching accounts is an admin action. The search text is not logged (it can be an email), only its length.
  await audit({ adminId: admin.id, action: 'view_user_list', target: '/users', details: { count: users.length, searched: q.length > 0, search_length: q.length, page } });

  const href = (p: number) => `/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Users">Emails are masked here. Opening a user shows health data and is recorded in the audit log.</PageHeader>
      {params.deleted ? <p role="status" className="mb-4 rounded-md border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-300">Account deleted.</p> : null}

      <form method="get" className="mb-6 flex max-w-xl gap-3">
        <Input name="q" defaultValue={q} placeholder="Search by email or user id" aria-label="Search by email or user id" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <Table
        head={['Email', 'Plan', 'Status', 'Signed up', 'Last active']}
        rows={users.map((u) => [
          <Link key={u.id} href={`/users/${u.id}`} className="text-emerald-400 hover:underline">{maskEmail(u.email)}</Link>,
          u.tier,
          u.status,
          date(u.created_at),
          date(u.last_active),
        ])}
      />
      <nav aria-label="Pages" className="mt-4 flex gap-3 text-sm">
        {page > 0 ? <Link href={href(page - 1)} className="text-emerald-400 hover:underline">Previous</Link> : null}
        {users.length === PAGE_SIZE ? <Link href={href(page + 1)} className="text-emerald-400 hover:underline">Next</Link> : null}
      </nav>
    </>
  );
}
