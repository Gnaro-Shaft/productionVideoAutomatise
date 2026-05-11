'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function AssetAudio({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ url: string; expiresAt: string }>(
          `/v1/assets/${assetId}/url`,
        );
        if (!cancelled) setUrl(res.url);
      } catch {
        // silent — UI just shows nothing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (!url) {
    return <div className="text-xs text-zinc-600">loading audio…</div>;
  }

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio src={url} controls className="w-full" />;
}
