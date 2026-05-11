import { z } from 'zod';

// Mirrors Prisma enums — keep in sync with prisma/schema.prisma

export const Format = z.enum(['VERTICAL_9_16', 'HORIZONTAL_16_9', 'SQUARE_1_1']);
export type Format = z.infer<typeof Format>;

export const ProjectStatus = z.enum([
  'DRAFT',
  'PLANNING',
  'GENERATING',
  'RENDERING',
  'COMPLETED',
  'FAILED',
  'ARCHIVED',
]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const SceneStatus = z.enum(['PENDING', 'GENERATING', 'READY', 'FAILED']);
export type SceneStatus = z.infer<typeof SceneStatus>;

export const RenderStatus = z.enum(['PENDING', 'RENDERING', 'COMPLETED', 'FAILED']);
export type RenderStatus = z.infer<typeof RenderStatus>;

export const JobStatus = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'RETRYING',
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const AssetKind = z.enum([
  'REFERENCE_IMAGE',
  'IMAGE',
  'VIDEO_CLIP',
  'VOICE_OVER',
  'DIALOGUE',
  'MUSIC',
  'SFX',
  'LIPSYNC_VIDEO',
  'SUBTITLE_VTT',
  'PROJECT_MUSIC',
  'MASTER_AUDIO_MIX',
  'MASTER_VIDEO',
  'THUMBNAIL',
]);
export type AssetKind = z.infer<typeof AssetKind>;

export const JobKind = z.enum([
  'PLAN_SCRIPT',
  'GEN_STORYBOARD',
  'GEN_IMAGE',
  'GEN_VIDEO',
  'GEN_VOICE',
  'GEN_DIALOGUE',
  'GEN_MUSIC',
  'GEN_SFX',
  'RUN_LIPSYNC',
  'TRANSLATE',
  'GEN_SUBTITLES',
  'RENDER_SCENE',
  'RENDER_FINAL',
  'MUX_AUDIO',
]);
export type JobKind = z.infer<typeof JobKind>;

export const PlatformHint = z.enum([
  'tiktok',
  'reels',
  'youtube_short',
  'youtube_long',
  'linkedin',
]);
export type PlatformHint = z.infer<typeof PlatformHint>;

// BCP-47 locale (e.g. fr-FR, en-US, es-ES)
export const Locale = z
  .string()
  .regex(/^[a-z]{2}-[A-Z]{2}$/, 'Must be BCP-47 (e.g. fr-FR)');
export type Locale = z.infer<typeof Locale>;
