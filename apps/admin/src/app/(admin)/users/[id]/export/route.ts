import { NextResponse } from 'next/server';
import { EXPORT_TABLES, buildExport } from '@/lib/export';
import { audit, requireAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** All of one user's data as JSON (a GDPR access request handled by an admin). Audited before anything is read. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse('Not found', { status: 404 });

  await audit({ adminId: admin.id, action: 'export_user_data', target: `user:${id}` });
  const db = createAdminClient();
  const [{ data: auth }, ...results] = await Promise.all([
    db.auth.admin.getUserById(id),
    ...EXPORT_TABLES.map((t) => db.from(t).select('*').eq('user_id', id).limit(50_000)),
  ]);
  if (!auth.user) return new NextResponse('Not found', { status: 404 });
  const tables: Record<string, unknown[] | null> = {};
  EXPORT_TABLES.forEach((t, i) => (tables[t] = results[i].data));

  return new NextResponse(JSON.stringify(buildExport(id, auth.user.email ?? null, tables), null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="export-${id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
