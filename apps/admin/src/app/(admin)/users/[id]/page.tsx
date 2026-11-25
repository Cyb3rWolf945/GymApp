import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { audit, requireAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Health data is special-category data (GDPR): the audit row is written BEFORE anything is read or shown.
  // If the audit write fails, this page throws and shows nothing.
  await audit({ adminId: admin.id, action: 'view_user_health', target: `user:${id}` });

  const db = createAdminClient();
  const [{ data: profile }, { data: ent }] = await Promise.all([
    db.from('profiles').select('display_name,sex,height_cm,weight_kg,experience').eq('user_id', id).maybeSingle(),
    db.from('entitlements').select('tier,status,current_period_end').eq('user_id', id).maybeSingle(),
  ]);
  if (!profile) notFound();

  const fields: [string, string][] = [
    ['Name', profile.display_name ?? '–'],
    ['Sex', profile.sex ?? '–'],
    ['Height', profile.height_cm ? `${profile.height_cm} cm` : '–'],
    ['Weight', profile.weight_kg ? `${profile.weight_kg} kg` : '–'],
    ['Experience', profile.experience ?? '–'],
    ['Plan', `${ent?.tier ?? 'none'} (${ent?.status ?? 'none'})`],
  ];
  return (
    <>
      <PageHeader title="User">This view is recorded in the audit log.</PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {fields.map(([k, v]) => (
          <Card key={k}>
            <CardTitle>{k}</CardTitle>
            <CardValue className="text-lg">{v}</CardValue>
          </Card>
        ))}
      </div>
    </>
  );
}
