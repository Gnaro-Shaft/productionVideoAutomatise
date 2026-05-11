import { env } from '../config';

// ── Types ────────────────────────────────────────────────────────────

export interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export type ComfyWorkflow = Record<string, ComfyNode>;

export interface ComfyOutputFile {
  filename: string;
  subfolder: string;
  type: 'output' | 'input' | 'temp';
}

export interface ComfyHistoryEntry {
  prompt: unknown;
  outputs: Record<string, { images?: ComfyOutputFile[] }>;
  status?: { completed: boolean; status_str: string; messages?: unknown[] };
}

// ── Client ───────────────────────────────────────────────────────────

const CLIENT_ID = 'pva-orchestrator';

export class ComfyClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = env.COMFY_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async submitPrompt(workflow: ComfyWorkflow): Promise<string> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: CLIENT_ID }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`comfy POST /prompt ${res.status}: ${text.slice(0, 800)}`);
    }
    const data = (await res.json()) as { prompt_id?: string; node_errors?: unknown };
    if (!data.prompt_id) {
      throw new Error(`comfy /prompt missing prompt_id: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return data.prompt_id;
  }

  async getHistory(promptId: string): Promise<ComfyHistoryEntry | null> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, ComfyHistoryEntry>;
    return data[promptId] ?? null;
  }

  /** Polls /history until the prompt completes. Throws on timeout. */
  async waitForCompletion(
    promptId: string,
    {
      timeoutMs = 10 * 60 * 1000,
      pollIntervalMs = 1500,
    }: { timeoutMs?: number; pollIntervalMs?: number } = {},
  ): Promise<ComfyHistoryEntry> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const entry = await this.getHistory(promptId);
      if (entry?.status?.completed) {
        const ok = entry.status.status_str === 'success';
        if (!ok) {
          throw new Error(
            `comfy prompt ${promptId} ended with ${entry.status.status_str}: ${JSON.stringify(entry.status.messages ?? []).slice(0, 500)}`,
          );
        }
        return entry;
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`comfy prompt ${promptId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Asks ComfyUI to unload models and free memory. Best-effort (warns on failure
   * but doesn't throw — this is an optimization, not a correctness requirement).
   */
  async freeModels(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models: true, free_memory: true }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`comfy /free returned ${res.status}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`comfy /free failed: ${(err as Error).message}`);
    }
  }

  /**
   * Uploads an image to ComfyUI's `input/` directory so LoadImage nodes can read it.
   * Returns the filename ComfyUI assigned (may differ if subfolder/rename happens).
   */
  async uploadImage(bytes: Buffer, filename: string): Promise<string> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    form.append('image', blob, filename);
    form.append('overwrite', 'true');

    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: form as unknown as BodyInit,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`comfy POST /upload/image ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as { name?: string; subfolder?: string };
    if (!data.name) {
      throw new Error(`comfy /upload/image missing name: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return data.name;
  }

  async downloadFile(file: ComfyOutputFile): Promise<Buffer> {
    const params = new URLSearchParams({
      filename: file.filename,
      subfolder: file.subfolder ?? '',
      type: file.type ?? 'output',
    });
    const res = await fetch(`${this.baseUrl}/view?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`comfy GET /view ${res.status}: ${file.filename}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

export function findFirstImage(entry: ComfyHistoryEntry): ComfyOutputFile | null {
  for (const nodeId of Object.keys(entry.outputs ?? {})) {
    const out = entry.outputs[nodeId];
    if (out?.images && out.images.length > 0) {
      return out.images[0] ?? null;
    }
  }
  return null;
}

/** Collects ALL output images from all nodes — used to grab a PNG sequence. */
export function findAllImages(entry: ComfyHistoryEntry): ComfyOutputFile[] {
  const out: ComfyOutputFile[] = [];
  for (const nodeId of Object.keys(entry.outputs ?? {})) {
    const node = entry.outputs[nodeId];
    if (node?.images) out.push(...node.images);
  }
  return out;
}

export function pickDimensions(format: string): { width: number; height: number } {
  switch (format) {
    case 'VERTICAL_9_16':
      return { width: 720, height: 1280 };
    case 'HORIZONTAL_16_9':
      return { width: 1280, height: 720 };
    case 'SQUARE_1_1':
      return { width: 1024, height: 1024 };
    default:
      return { width: 1024, height: 1024 };
  }
}

// ── FLUX Schnell workflow builder ────────────────────────────────────

export interface FluxSchnellInput {
  prompt: string;
  width: number;
  height: number;
  seed: number;
  steps?: number; // default 4 (Schnell is distilled, 4 steps is enough)
  cfg?: number; //   default 1.0 (Schnell does not use CFG)
}

export const FLUX_SCHNELL_WORKFLOW_REF = 'image_flux_schnell.v1';

export function buildFluxSchnellWorkflow(input: FluxSchnellInput): ComfyWorkflow {
  const { prompt, width, height, seed, steps = 4, cfg = 1.0 } = input;

  return {
    '1': {
      class_type: 'UNETLoader',
      inputs: {
        unet_name: 'flux1-schnell.safetensors',
        weight_dtype: 'default',
      },
    },
    '2': {
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: 't5xxl_fp8_e4m3fn.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux',
      },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: {
        vae_name: 'ae.safetensors',
      },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['2', 0] },
    },
    '5': {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: ['2', 0] },
    },
    '6': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '7': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['4', 0],
        negative: ['5', 0],
        latent_image: ['6', 0],
        seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['7', 0], vae: ['3', 0] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { images: ['8', 0], filename_prefix: 'pva' },
    },
  };
}

// ── LTX-Video Img2Video workflow builder ─────────────────────────────

export interface LTXVideoInput {
  imageFilename: string; // already uploaded to ComfyUI input/ via uploadImage()
  prompt: string; // motion description in English (e.g. "slow dolly in, snow falls")
  width: number;
  height: number;
  numFrames: number; // 49 = ~2s at 24fps
  seed: number;
  steps?: number;
  cfg?: number;
  /** Image conditioning strength. 1.0 = preserve input image strongly, 0.5 = looser. */
  strength?: number;
}

export const LTX_VIDEO_WORKFLOW_REF = 'video_ltx.v1';
export const LTX_VIDEO_FPS = 24;
export const LTX_VIDEO_CHECKPOINT = 'ltx-video-2b-v0.9.5.safetensors';
export const LTX_T5_FILENAME = 't5xxl_fp8_e4m3fn.safetensors';

export function buildLTXImageToVideoWorkflow(input: LTXVideoInput): ComfyWorkflow {
  const {
    imageFilename,
    prompt,
    width,
    height,
    numFrames,
    seed,
    steps = 20,
    cfg = 3.0,
    strength = 1.0,
  } = input;

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: LTX_VIDEO_CHECKPOINT },
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: { clip_name: LTX_T5_FILENAME, type: 'ltxv' },
    },
    '3': {
      class_type: 'LoadImage',
      inputs: { image: imageFilename },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['2', 0] },
    },
    '5': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'low quality, static, blurry, distorted, watermark',
        clip: ['2', 0],
      },
    },
    '6': {
      class_type: 'LTXVImgToVideo',
      inputs: {
        positive: ['4', 0],
        negative: ['5', 0],
        vae: ['1', 2],
        image: ['3', 0],
        width,
        height,
        length: numFrames,
        batch_size: 1,
        strength,
      },
    },
    '7': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['6', 0],
        negative: ['6', 1],
        latent_image: ['6', 2],
        seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['7', 0], vae: ['1', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { images: ['8', 0], filename_prefix: 'pva_ltx' },
    },
  };
}
