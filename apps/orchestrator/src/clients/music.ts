import { env } from '../config';

export interface MusicRequest {
  prompt: string;
  durationSec: number;
}

export class MusicClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = env.MUSIC_SVC_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Returns raw WAV bytes (audio/wav). */
  async synthesize(req: MusicRequest): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`music /music ${res.status}: ${text.slice(0, 500)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
