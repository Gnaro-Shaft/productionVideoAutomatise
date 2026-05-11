import type { ProjectStatus, RenderStatus, SceneStatus } from '@pva/shared-types';

type AnyStatus = ProjectStatus | SceneStatus | RenderStatus | string;

const STYLES: Record<string, string> = {
  DRAFT: 'bg-zinc-700 text-zinc-300',
  PLANNING: 'bg-blue-700/40 text-blue-300',
  GENERATING: 'bg-amber-700/40 text-amber-300',
  RENDERING: 'bg-purple-700/40 text-purple-300',
  COMPLETED: 'bg-emerald-700/40 text-emerald-300',
  FAILED: 'bg-red-700/40 text-red-300',
  ARCHIVED: 'bg-zinc-700 text-zinc-400',
  PENDING: 'bg-zinc-700 text-zinc-300',
  READY: 'bg-emerald-700/40 text-emerald-300',
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const style = STYLES[status as string] ?? STYLES.DRAFT;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
