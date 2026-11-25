import { ComingSoon } from '@/components/coming-soon';
import { requireAdmin } from '@/lib/session';

export default async function AdsPage() {
  await requireAdmin();
  return <ComingSoon title="Ads" where="the ads issue" />;
}
