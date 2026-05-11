import { ApplicationFailure } from '@temporalio/activity';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ComfyClient,
  FLUX_SCHNELL_WORKFLOW_REF,
  LTX_VIDEO_CHECKPOINT,
  LTX_VIDEO_FPS,
  LTX_VIDEO_WORKFLOW_REF,
  buildFluxSchnellWorkflow,
  buildLTXImageToVideoWorkflow,
  findAllImages,
  findFirstImage,
  pickDimensions,
} from '../clients/comfy';
import { pngSequenceToMp4 } from '../lib/ffmpeg';
import { signedDownloadUrl } from '../lib/storage';
import { MusicClient } from '../clients/music';
import { VoiceClient } from '../clients/voice';
import { db } from '../lib/db';
import { publishWsEvent } from '../lib/progress';
import { uploadAsset } from '../lib/storage';

const FLUX_MODEL_NAME = 'flux.1-schnell';
const FLUX_MODEL_VERSION = '1.0';

// ── Memory hygiene — frees ComfyUI's resident FLUX (~22 GB on M5 Pro) ──

export async function unloadComfyModels(): Promise<void> {
  const comfy = new ComfyClient();
  await comfy.freeModels();
}

// ── REAL: image generation via ComfyUI + FLUX Schnell ────────────────

export async function genImage(input: {
  sceneId: string;
  promptOverride?: string;
  seed?: number;
}): Promise<{ assetId: string; url: string | null }> {
  // 1. Load scene + project for context
  const scene = await db().scene.findUnique({
    where: { id: input.sceneId },
    include: { project: true },
  });
  if (!scene) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Scene ${input.sceneId} not found`,
      nonRetryable: true,
    });
  }

  const prompt = input.promptOverride ?? scene.imagePrompt ?? scene.visualDescription;
  if (!prompt) {
    throw ApplicationFailure.create({
      type: 'ValidationError',
      message: `Scene ${input.sceneId} has no imagePrompt`,
      nonRetryable: true,
    });
  }

  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const { width, height } = pickDimensions(scene.project.format);

  // 2. Build + submit ComfyUI workflow
  const comfy = new ComfyClient();
  const workflow = buildFluxSchnellWorkflow({ prompt, width, height, seed });
  const promptId = await comfy.submitPrompt(workflow);

  // 3. Wait for completion (FLUX Schnell on M-series Mac: ~15-60s)
  const entry = await comfy.waitForCompletion(promptId, {
    timeoutMs: 4 * 60 * 1000,
    pollIntervalMs: 1500,
  });

  // 4. Fetch the rendered image
  const outputFile = findFirstImage(entry);
  if (!outputFile) {
    throw new Error(`comfy returned no images for prompt ${promptId}`);
  }
  const bytes = await comfy.downloadFile(outputFile);

  // 5. Upload to MinIO
  const s3Key = `projects/${scene.projectId}/scenes/${scene.id}/image/${Date.now()}.png`;
  const upload = await uploadAsset({ key: s3Key, body: bytes, mime: 'image/png' });

  // 6. Atomically: create Asset row + point Scene.selectedImageAssetId at it
  const asset = await db().$transaction(async (tx) => {
    const last = await tx.asset.findFirst({
      where: { projectId: scene.projectId, sceneId: scene.id, kind: 'IMAGE' },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    const created = await tx.asset.create({
      data: {
        projectId: scene.projectId,
        sceneId: scene.id,
        kind: 'IMAGE',
        version,
        s3Bucket: upload.bucket,
        s3Key: upload.key,
        mime: 'image/png',
        sizeBytes: upload.sizeBytes,
        checksum: upload.checksum,
        width,
        height,
        modelName: FLUX_MODEL_NAME,
        modelVersion: FLUX_MODEL_VERSION,
        workflowRef: FLUX_SCHNELL_WORKFLOW_REF,
        promptUsed: prompt,
        seed,
        parameters: {
          width,
          height,
          steps: 4,
          cfg: 1.0,
          sampler: 'euler',
          scheduler: 'simple',
        },
      },
    });

    await tx.scene.update({
      where: { id: scene.id },
      data: { selectedImageAssetId: created.id },
    });

    return created;
  });

  // 7. Publish progress event for the UI
  await publishWsEvent(scene.projectId, {
    type: 'scene.asset_ready',
    data: {
      projectId: scene.projectId,
      sceneId: scene.id,
      idx: scene.idx,
      kind: 'IMAGE',
      assetId: asset.id,
      version: asset.version,
      url: null, // signed URL fetched on-demand by api-gateway
    },
  });

  return { assetId: asset.id, url: null };
}

// ── STUBS — to be wired in next iterations ───────────────────────────

// ── REAL: image-to-video via ComfyUI + LTX-Video ─────────────────────

const LTX_NUM_FRAMES = 97; // 97 frames @ 24fps ≈ 4.04 seconds — sweet spot quality/memory on M5 Pro
const LTX_STEPS = 25;
const LTX_STRENGTH = 0.95;

export async function genVideo(input: {
  sceneId: string;
  imageAssetId: string;
  promptOverride?: string;
  seed?: number;
}): Promise<{ assetId: string; url: string | null }> {
  // 1. Load scene + project + selected image
  const scene = await db().scene.findUnique({
    where: { id: input.sceneId },
    include: { project: true, selectedImage: true },
  });
  if (!scene) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Scene ${input.sceneId} not found`,
      nonRetryable: true,
    });
  }
  if (!scene.selectedImage) {
    throw ApplicationFailure.create({
      type: 'ValidationError',
      message: `Scene ${input.sceneId} has no selectedImage — run genImage first`,
      nonRetryable: true,
    });
  }

  const motionPrompt =
    input.promptOverride ?? scene.videoPrompt ?? 'smooth cinematic camera motion, subtle parallax';
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const { width, height } = pickDimensions(scene.project.format);
  const comfy = new ComfyClient();

  // 2. Download the source image from MinIO via signed URL
  const imageSignedUrl = await signedDownloadUrl(
    scene.selectedImage.s3Bucket,
    scene.selectedImage.s3Key,
  );
  const imageRes = await fetch(imageSignedUrl);
  if (!imageRes.ok) {
    throw new Error(`failed to download source image: ${imageRes.status}`);
  }
  const imageBytes = Buffer.from(await imageRes.arrayBuffer());

  // 3. Upload to ComfyUI input dir
  const uploadedFilename = await comfy.uploadImage(
    imageBytes,
    `scene-${scene.id}.png`,
  );

  // 4. Build + submit LTX I2V workflow
  const workflow = buildLTXImageToVideoWorkflow({
    imageFilename: uploadedFilename,
    prompt: motionPrompt,
    width,
    height,
    numFrames: LTX_NUM_FRAMES,
    seed,
    steps: LTX_STEPS,
    strength: LTX_STRENGTH,
  });
  const promptId = await comfy.submitPrompt(workflow);

  // 5. Wait for completion (LTX on M5 Pro: ~1-3 min for 2s of video)
  const entry = await comfy.waitForCompletion(promptId, {
    timeoutMs: 15 * 60 * 1000,
    pollIntervalMs: 2000,
  });

  // 6. Collect all PNG frames
  const frames = findAllImages(entry);
  if (frames.length === 0) {
    throw new Error(`comfy returned no frames for prompt ${promptId}`);
  }

  // 7. Download frames into a temp dir, named frame_00001.png, frame_00002.png, ...
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ltx-'));
  try {
    for (let i = 0; i < frames.length; i++) {
      const file = frames[i];
      if (!file) continue;
      const bytes = await comfy.downloadFile(file);
      const framePath = path.join(
        tmpDir,
        `frame_${String(i + 1).padStart(5, '0')}.png`,
      );
      await fs.promises.writeFile(framePath, bytes);
    }

    // 8. Convert PNG sequence → MP4
    const mp4Path = path.join(tmpDir, 'output.mp4');
    await pngSequenceToMp4({
      framesGlob: path.join(tmpDir, 'frame_%05d.png'),
      outputPath: mp4Path,
      fps: LTX_VIDEO_FPS,
    });

    const mp4Bytes = await fs.promises.readFile(mp4Path);

    // 9. Upload to MinIO
    const s3Key = `projects/${scene.projectId}/scenes/${scene.id}/video/${Date.now()}.mp4`;
    const upload = await uploadAsset({
      key: s3Key,
      body: mp4Bytes,
      mime: 'video/mp4',
    });

    const durationMs = Math.round((frames.length / LTX_VIDEO_FPS) * 1000);

    // 10. Atomically create Asset + point Scene.selectedVideoAssetId at it
    const asset = await db().$transaction(async (tx) => {
      const last = await tx.asset.findFirst({
        where: {
          projectId: scene.projectId,
          sceneId: scene.id,
          kind: 'VIDEO_CLIP',
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (last?.version ?? 0) + 1;

      const created = await tx.asset.create({
        data: {
          projectId: scene.projectId,
          sceneId: scene.id,
          kind: 'VIDEO_CLIP',
          version,
          s3Bucket: upload.bucket,
          s3Key: upload.key,
          mime: 'video/mp4',
          sizeBytes: upload.sizeBytes,
          checksum: upload.checksum,
          durationMs,
          width,
          height,
          modelName: 'ltx-video',
          modelVersion: '0.9.5',
          workflowRef: LTX_VIDEO_WORKFLOW_REF,
          promptUsed: motionPrompt,
          seed,
          parameters: {
            width,
            height,
            numFrames: frames.length,
            fps: LTX_VIDEO_FPS,
            checkpoint: LTX_VIDEO_CHECKPOINT,
          },
        },
      });

      await tx.scene.update({
        where: { id: scene.id },
        data: { selectedVideoAssetId: created.id },
      });

      return created;
    });

    await publishWsEvent(scene.projectId, {
      type: 'scene.asset_ready',
      data: {
        projectId: scene.projectId,
        sceneId: scene.id,
        idx: scene.idx,
        kind: 'VIDEO_CLIP',
        assetId: asset.id,
        version: asset.version,
        url: null,
      },
    });

    return { assetId: asset.id, url: null };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── REAL: voice synthesis via Piper TTS ──────────────────────────────

const VOICE_MODEL_NAME = 'piper.tts';
const VOICE_MODEL_VERSION = '1.0';
const VOICE_WORKFLOW_REF = 'voice_piper.v1';

const voiceClient = new VoiceClient();

export async function genVoice(input: {
  sceneId: string;
  locale: string;
  promptOverride?: string;
}): Promise<{ assetId: string; url: string | null }> {
  // 1. Load scene + the SceneLocale row matching the requested locale
  const scene = await db().scene.findUnique({
    where: { id: input.sceneId },
    include: {
      project: true,
      locales: { where: { locale: input.locale } },
    },
  });
  if (!scene) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Scene ${input.sceneId} not found`,
      nonRetryable: true,
    });
  }
  const sceneLocale = scene.locales[0];
  if (!sceneLocale) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `SceneLocale (${input.sceneId}, ${input.locale}) not found`,
      nonRetryable: true,
    });
  }

  const text = input.promptOverride ?? sceneLocale.voiceText;
  if (!text) {
    throw ApplicationFailure.create({
      type: 'ValidationError',
      message: `No voiceText for scene ${input.sceneId} locale ${input.locale}`,
      nonRetryable: true,
    });
  }

  const speed = sceneLocale.voiceSpeed ?? 1.0;

  // 2. Synthesize via voice-svc (Piper TTS)
  const wav = await voiceClient.synthesize({
    text,
    locale: input.locale,
    speed,
    speakerType: sceneLocale.voiceSpeakerType,
    emotion: sceneLocale.voiceEmotion,
  });

  // 3. Upload WAV to MinIO
  const s3Key = `projects/${scene.projectId}/scenes/${scene.id}/voice/${input.locale}/${Date.now()}.wav`;
  const upload = await uploadAsset({ key: s3Key, body: wav, mime: 'audio/wav' });

  // 4. Atomically: create Asset row + point SceneLocale.voiceAssetId at it
  const asset = await db().$transaction(async (tx) => {
    const last = await tx.asset.findFirst({
      where: { projectId: scene.projectId, sceneId: scene.id, kind: 'VOICE_OVER' },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    const created = await tx.asset.create({
      data: {
        projectId: scene.projectId,
        sceneId: scene.id,
        kind: 'VOICE_OVER',
        version,
        s3Bucket: upload.bucket,
        s3Key: upload.key,
        mime: 'audio/wav',
        sizeBytes: upload.sizeBytes,
        checksum: upload.checksum,
        modelName: VOICE_MODEL_NAME,
        modelVersion: VOICE_MODEL_VERSION,
        workflowRef: VOICE_WORKFLOW_REF,
        promptUsed: text,
        parameters: { locale: input.locale, speed, voice: 'piper-default' },
      },
    });

    await tx.sceneLocale.update({
      where: { id: sceneLocale.id },
      data: { voiceAssetId: created.id },
    });

    return created;
  });

  await publishWsEvent(scene.projectId, {
    type: 'scene.asset_ready',
    data: {
      projectId: scene.projectId,
      sceneId: scene.id,
      idx: scene.idx,
      kind: 'VOICE_OVER',
      assetId: asset.id,
      version: asset.version,
      url: null,
    },
  });

  return { assetId: asset.id, url: null };
}

/** TEMPORARY no-op — wired in the next iteration (Stable Audio Open). */
export async function genSfx(input: {
  sceneId: string;
  prompt: string;
}): Promise<{ assetId: string }> {
  // eslint-disable-next-line no-console
  console.log(`[genSfx] no-op for scene ${input.sceneId}`);
  return { assetId: `noop-sfx-${input.sceneId}` };
}

// ── REAL: project-level music via MusicGen ──────────────────────────

const MUSIC_MODEL_NAME = 'musicgen';
const MUSIC_MODEL_VERSION = 'medium';
const MUSIC_WORKFLOW_REF = 'music_musicgen.v1';
const MUSIC_DURATION_CAP_SEC = 10; // Memory-safe peak; render loops the track to cover full video

const musicClient = new MusicClient();

function buildMusicPrompt(opts: {
  styleHint: string | null;
  tone: string | undefined;
  sceneHints: string[];
}): string {
  // Aggregate cues into a single coherent prompt in English (MusicGen prefers EN).
  const hints = opts.sceneHints
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  const parts = [
    'cinematic background score',
    opts.tone || '',
    opts.styleHint || '',
    hints,
    'continuous, no vocals, instrumental',
  ].filter(Boolean);
  return parts.join(', ');
}

export async function genMusic(input: {
  projectId: string;
}): Promise<{ assetId: string }> {
  const project = await db().project.findUnique({
    where: { id: input.projectId },
    include: {
      scenes: {
        orderBy: { idx: 'asc' },
        select: { musicPromptHint: true, durationSec: true },
      },
    },
  });
  if (!project) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Project ${input.projectId} not found`,
      nonRetryable: true,
    });
  }

  const script = (project.scriptJson as { tone?: string } | null) ?? null;
  const prompt = buildMusicPrompt({
    styleHint: project.styleHint,
    tone: script?.tone,
    sceneHints: project.scenes.map((s) => s.musicPromptHint ?? '').filter(Boolean),
  });

  const totalDuration = project.scenes.reduce(
    (sum, s) => sum + s.durationSec,
    0,
  );
  const durationSec = Math.min(MUSIC_DURATION_CAP_SEC, Math.max(8, totalDuration));

  // eslint-disable-next-line no-console
  console.log(
    `[genMusic] prompt=${prompt.slice(0, 100)} duration=${durationSec}s`,
  );

  const wav = await musicClient.synthesize({ prompt, durationSec });

  const s3Key = `projects/${project.id}/music/${Date.now()}.wav`;
  const upload = await uploadAsset({ key: s3Key, body: wav, mime: 'audio/wav' });

  const asset = await db().asset.create({
    data: {
      projectId: project.id,
      sceneId: null,
      kind: 'PROJECT_MUSIC',
      version: 1,
      s3Bucket: upload.bucket,
      s3Key: upload.key,
      mime: 'audio/wav',
      sizeBytes: upload.sizeBytes,
      checksum: upload.checksum,
      durationMs: Math.round(durationSec * 1000),
      modelName: MUSIC_MODEL_NAME,
      modelVersion: MUSIC_MODEL_VERSION,
      workflowRef: MUSIC_WORKFLOW_REF,
      promptUsed: prompt,
      parameters: { durationSec },
    },
  });

  // No scene.asset_ready event for project-level music (no sceneId).
  // The frontend picks it up via refetch on render.status COMPLETED.

  return { assetId: asset.id };
}

/** TEMPORARY no-op — wired in the next iteration (MuseTalk). */
export async function runLipSync(input: {
  sceneId: string;
  videoAssetId: string;
  voiceAssetId: string;
}): Promise<{ assetId: string }> {
  // eslint-disable-next-line no-console
  console.log(`[runLipSync] no-op for scene ${input.sceneId}`);
  return { assetId: `noop-lipsync-${input.sceneId}` };
}
