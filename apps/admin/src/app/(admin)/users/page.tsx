import Link from 'next/link';
import { PageHeader, Table } from '@/components/page';
import { audit, requireAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const PAGE_SIZE = 50;

export default async function UsersPage() {
  const admin = await requireAdmin();
  const db = createAdminClient();
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: PAGE_SIZE });
  const users = data?.users ?? [];
  const { data: ents } = await db.from('entitlements').select('user_id,tier,status').in('user_id', users.map((u) => u.id));
  const byUser = new Map((ents ?? []).map((e) => [e.user_id as string, e]));
  // Listing accounts is an admin action: record it (no health data is shown here).
  await audit({ adminId: admin.id, action: 'view_user_list', target: '/users', details: { count: users.length } });
  return (
    <>
      <PageHeader title="Users">Accounts and plans. Opening a user shows health data and is recorded in the audit log.</PageHeader>
      <Table
        head={['Email', 'Joined', 'Plan', 'Status']}
        rows={users.map((u) => [
          <Link key={u.id} href={`/users/${u.id}`} className="text-emerald-400 hover:underline">{u.email ?? u.id}</Link>,
          u.created_at.slice(0, 10),
          byUser.get(u.id)?.tier ?? 'none',
          byUser.get(u.id)?.status ?? 'none',
        ])}
      />
    </>
  );
}
