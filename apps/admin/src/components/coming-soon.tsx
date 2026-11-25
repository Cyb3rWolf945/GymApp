import { PageHeader } from '@/components/page';

export function ComingSoon({ title, where }: { title: string; where: string }) {
  return (
    <>
      <PageHeader title={title} />
      <p className="text-neutral-400">This section arrives with {where}.</p>
    </>
  );
}
