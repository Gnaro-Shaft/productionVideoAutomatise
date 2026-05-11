import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';

export interface SceneInput {
  imageUrl: string;
  videoUrl?: string | null;
  videoDurationSec?: number | null;
  audioUrl: string | null;
  durationSec: number;
  voiceText?: string;
}

export interface RenderInput {
  scenes: SceneInput[];
  format: string; // VERTICAL_9_16 | HORIZONTAL_16_9 | SQUARE_1_1
  musicUrl: string | null;
  outputPath: string;
}

let _bundleLocation: string | null = null;
let _bundlePromise: Promise<string> | null = null;

const REMOTION_ENTRY = path.join(__dirname, '..', 'remotion', 'index.tsx');

async function getBundleLocation(): Promise<string> {
  if (_bundleLocation) return _bundleLocation;
  if (_bundlePromise) return _bundlePromise;

  _bundlePromise = (async () => {
    console.log('[render-svc] bundling Remotion composition…');
    const start = Date.now();
    const loc = await bundle({
      entryPoint: REMOTION_ENTRY,
      onProgress: (p) => {
        if (p === 100) console.log('[render-svc] bundle 100%');
      },
    });
    console.log(`[render-svc] bundle ready in ${Math.round((Date.now() - start) / 1000)}s → ${loc}`);
    _bundleLocation = loc;
    return loc;
  })();

  return _bundlePromise;
}

/**
 * Eagerly downloads Chromium + pre-bundles the composition so first /render is fast.
 */
export async function warmUp(): Promise<void> {
  console.log('[render-svc] ensuring Chromium is available…');
  await ensureBrowser();
  await getBundleLocation();
  console.log('[render-svc] warm-up done');
}

export async function renderStory(input: RenderInput): Promise<{
  outputPath: string;
  durationSec: number;
}> {
  const serveUrl = await getBundleLocation();
  const inputProps = {
    scenes: input.scenes,
    format: input.format,
    musicUrl: input.musicUrl,
  };

  const composition = await selectComposition({
    serveUrl,
    id: 'Story',
    inputProps,
  });

  let lastPctLogged = -10;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: input.outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct - lastPctLogged >= 10) {
        console.log(`[render-svc] rendering ${pct}%`);
        lastPctLogged = pct;
      }
    },
  });

  const durationSec = input.scenes.reduce(
    (sum, s) => sum + Math.max(0.1, s.durationSec),
    0,
  );
  return { outputPath: input.outputPath, durationSec };
}
