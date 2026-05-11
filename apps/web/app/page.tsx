import type { ProjectSummary } from '@pva/shared-types';
import Link from 'next/link';
import { ProjectCard } from '@/components/ProjectCard';
import { api } from '@/lib/api';

interface ListResponse {
  items: ProjectSummary[];
  nextCursor: string | null;
}

export default async function HomePage() {
  let projects: ProjectSummary[] = [];
  let error: string | null = null;
  try {
    const res = await api<ListResponse>('/v1/projects?limit=50');
    projects = res.items;
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-sm text-red-300">Failed to load projects: {error}</p>
        <p className="mt-2 text-xs text-zinc-400">
          Check that the api-gateway is running on http://localhost:4000
        </p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-700 p-12 text-center">
        <p className="text-zinc-400">No projects yet.</p>
        <Link
          href="/projects/new"
          className="mt-4 inline-block text-blue-400 hover:underline"
        >
          Create your first project →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
