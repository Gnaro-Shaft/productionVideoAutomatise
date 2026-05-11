'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function AssetImage({ assetId, alt }: { assetId: string; alt: string }) {
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
      <div className="flex h-full items-center justify-center text-xs text-red-400">!</div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-600">…</div>
    );
  }
  // Using <img> rather than next/image because MinIO signed URLs include
  // dynamic query params and aren't worth optimizing through Next.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-full w-full object-cover" />;
}
