import type { ProjectSummary } from '@pva/shared-types';
import Link from 'next/link';
import { StatusBadge } from './StatusBadge';

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-medium">{project.title}</h3>
        <StatusBadge status={project.status} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {project.format} · {project.durationTargetSec}s · {project.sourceLocale}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${Math.round(project.progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        {new Date(project.createdAt).toLocaleString('fr-FR')}
      </p>
    </Link>
  );
}
