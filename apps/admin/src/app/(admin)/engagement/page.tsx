import { ComingSoon } from '@/components/coming-soon';
import { requireAdmin } from '@/lib/session';

export default async function EngagementPage() {
  await requireAdmin();
  return <ComingSoon title="Engagement" where="the engagement issue" />;
}
