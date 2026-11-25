import { ComingSoon } from '@/components/coming-soon';
import { requireAdmin } from '@/lib/session';

export default async function ContentPage() {
  await requireAdmin();
  return <ComingSoon title="Content" where="the content issue" />;
}
