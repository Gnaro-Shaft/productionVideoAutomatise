'use client';

import type { ProjectDetail, WsEventEnvelope } from '@pva/shared-types';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/ws';
import { AssetVideo } from './AssetVideo';
import { SceneCard } from './SceneCard';
import { StatusBadge } from './StatusBadge';

export function LiveProject({ initialProject }: { initialProject: ProjectDetail }) {
  const [project, setProject] = useState(initialProject);

  useEffect(() => {
    const socket = connectSocket();
    socket.emit('subscribe', { projectId: project.id });

    const refetch = async () => {
      try {
        const fresh = await api<ProjectDetail>(`/v1/projects/${project.id}`);
        setProject(fresh);
      } catch {
        // ignore — keep existing state
      }
    };

    socket.on('event', (event: WsEventEnvelope) => {
      switch (event.type) {
        case 'project.status':
          setProject((p) => ({
            ...p,
            status: event.data.status,
            progress: event.data.progress,
          }));
          break;
        case 'project.completed':
          void refetch();
          break;
        case 'project.failed':
          setProject((p) => ({ ...p, status: 'FAILED' }));
          break;
        case 'scene.status':
          setProject((p) => ({
            ...p,
            scenes: p.scenes.map((s) =>
              s.id === event.data.sceneId ? { ...s, status: event.data.status } : s,
            ),
          }));
          break;
        case 'scene.asset_ready':
          // Re-fetch to pull in the new asset (signed URL fetched on demand)
          void refetch();
          break;
        case 'render.status':
          void refetch();
          break;
        default:
          break;
      }
    });

    return () => {
      socket.emit('unsubscribe', { projectId: project.id });
      socket.disconnect();
    };
  }, [project.id]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-sm text-zinc-400">{project.prompt}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${Math.round(project.progress * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {project.format} · {project.durationTargetSec}s · {project.sourceLocale}
        </p>
      </div>

      {/* Final master video (top of the page when available) */}
      {(() => {
        const completed = project.renders.find(
          (r) => r.status === 'COMPLETED' && r.outputAsset,
        );
        if (!completed?.outputAsset) return null;
        return (
          <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-emerald-300">Master video</span>
              <span className="text-xs text-zinc-500">
                {completed.locale} · {completed.format} · {completed.durationSec}s
              </span>
            </div>
            <AssetVideo assetId={completed.outputAsset.id} />
          </div>
        );
      })()}

      {project.seoTitle && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm font-medium">{project.seoTitle}</p>
          {project.seoDescription && (
            <p className="mt-1 text-xs text-zinc-400">{project.seoDescription}</p>
          )}
          {project.seoHashtags.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              {project.seoHashtags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')}
            </p>
          )}
        </div>
      )}

      {project.scriptJson != null && typeof project.scriptJson === 'object' && (
        <details className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">
            Script (raw JSON)
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
            {JSON.stringify(project.scriptJson, null, 2)}
          </pre>
        </details>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Scenes ({project.scenes.length})
        </h2>
        {project.scenes.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
            Storyboard not generated yet…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {project.scenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
