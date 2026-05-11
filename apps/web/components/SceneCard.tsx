import type { SceneView } from '@pva/shared-types';
import { AssetAudio } from './AssetAudio';
import { AssetImage } from './AssetImage';
import { StatusBadge } from './StatusBadge';

export function SceneCard({ scene }: { scene: SceneView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="aspect-[9/16] w-full bg-zinc-950">
        {scene.selectedImage ? (
          <AssetImage assetId={scene.selectedImage.id} alt={`Scene ${scene.idx}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            Generating…
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">
            Scene {scene.idx} · {scene.durationSec}s
          </span>
          <StatusBadge status={scene.status} />
        </div>
        <p className="line-clamp-2 text-xs text-zinc-400">{scene.narrativeGoal}</p>
        {scene.mood && (
          <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-zinc-600">
            {scene.mood}
          </span>
        )}
        {scene.locales.map((loc) =>
          loc.voiceAsset ? (
            <div key={loc.locale} className="mt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {loc.locale}
              </p>
              <AssetAudio assetId={loc.voiceAsset.id} />
              {loc.voiceText && (
                <p className="line-clamp-2 text-[10px] italic text-zinc-500">
                  &laquo; {loc.voiceText} &raquo;
                </p>
              )}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
