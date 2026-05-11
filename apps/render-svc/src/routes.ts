import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { renderStory, type SceneInput } from './render';

const router = express.Router();

const SceneSchema = z.object({
  imageUrl: z.string().url(),
  videoUrl: z.string().url().nullable().optional(),
  videoDurationSec: z.number().positive().nullable().optional(),
  audioUrl: z.string().url().nullable(),
  durationSec: z.number().positive(),
  voiceText: z.string().optional(),
});

const RenderRequest = z.object({
  scenes: z.array(SceneSchema).min(1),
  format: z.string().default('VERTICAL_9_16'),
  musicUrl: z.string().url().nullable().optional(),
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'render' });
});

router.post('/render', async (req: Request, res: Response) => {
  const parsed = RenderRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'validation',
      details: parsed.error.issues,
    });
  }

  const outputDir = path.join(os.tmpdir(), 'pva-renders');
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `render-${Date.now()}.mp4`);

  try {
    const result = await renderStory({
      scenes: parsed.data.scenes as SceneInput[],
      format: parsed.data.format,
      musicUrl: parsed.data.musicUrl ?? null,
      outputPath,
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('X-Render-Duration-Sec', String(result.durationSec));
    res.setHeader('Content-Disposition', 'inline; filename="render.mp4"');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlink(outputPath, () => {});
    });
    stream.on('error', (err) => {
      console.error('[render-svc] stream error', err);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    });
  } catch (err) {
    console.error('[render-svc] render failed', err);
    return res.status(500).json({
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
  }
});

export default router;
