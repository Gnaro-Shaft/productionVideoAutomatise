import { env } from '../config';

export interface SceneInput {
  imageUrl: string;
  videoUrl?: string | null;
  videoDurationSec?: number | null;
  audioUrl: string | null;
  durationSec: number;
  voiceText?: string;
}

export interface RenderRequest {
  scenes: SceneInput[];
  format: string;
  musicUrl?: string | null;
}

export class RenderClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = env.RENDER_SVC_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async render(req: RenderRequest): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      // Render can take a few minutes; rely on Temporal activity timeout
      // (no AbortSignal here so we don't double-fail).
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`render /render ${res.status}: ${text.slice(0, 500)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
