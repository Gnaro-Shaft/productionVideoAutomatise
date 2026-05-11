'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function AssetVideo({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ url: string; expiresAt: string }>(
          `/v1/assets/${assetId}/url`,
        );
        if (!cancelled) setUrl(res.url);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-red-400">
        Could not load video: {error}
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        loading…
      </div>
    );
  }

  return (
    <video
      src={url}
      controls
      playsInline
      className="mx-auto max-h-[80vh] w-auto rounded-lg shadow-2xl"
    />
  );
}
