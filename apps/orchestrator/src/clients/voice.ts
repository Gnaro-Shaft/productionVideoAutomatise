import { env } from '../config';

export interface TtsRequest {
  text: string;
  locale?: string;
  speed?: number;
  speakerType?: string | null;
  emotion?: string | null;
}

export class VoiceClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = env.VOICE_SVC_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Returns raw WAV bytes (audio/wav) ready to upload to S3. */
  async synthesize(req: TtsRequest): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: req.text,
        locale: req.locale ?? 'fr-FR',
        speed: req.speed ?? 1.0,
        speakerType: req.speakerType ?? null,
        emotion: req.emotion ?? null,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`voice /tts ${res.status}: ${text.slice(0, 500)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
