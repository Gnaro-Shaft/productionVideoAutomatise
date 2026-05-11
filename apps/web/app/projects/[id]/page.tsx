import type { ProjectDetail } from '@pva/shared-types';
import { notFound } from 'next/navigation';
import { LiveProject } from '@/components/LiveProject';
import { api } from '@/lib/api';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let initial: ProjectDetail;
  try {
    initial = await api<ProjectDetail>(`/v1/projects/${id}`);
  } catch (e) {
    if ((e as Error).message.includes('404')) notFound();
    throw e;
  }

  return <LiveProject initialProject={initial} />;
}
