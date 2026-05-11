import { z } from 'zod';
import { SceneStatus } from '../enums';
import { AssetRef } from './asset';
import { Cuid, IsoDateTime } from './common';

export const SceneLocaleView = z.object({
  locale: z.string(),
  voiceText: z.string(),
  dialogueText: z.string().nullable(),
  subtitleText: z.string().nullable(),
  voiceSpeakerType: z.string().nullable(),
  voiceEmotion: z.string().nullable(),
  voiceSpeed: z.number().default(1.0),
  voiceAsset: AssetRef.nullable(),
  lipSyncAsset: AssetRef.nullable(),
  subtitleAsset: AssetRef.nullable(),
});
export type SceneLocaleView = z.infer<typeof SceneLocaleView>;

export const SceneView = z.object({
  id: Cuid,
  idx: z.number().int().min(0),
  durationSec: z.number().int(),
  narrativeGoal: z.string(),
  visualDescription: z.string(),
  mood: z.string().nullable(),
  location: z.string().nullable(),
  cameraShotType: z.string().nullable(),
  cameraMovement: z.string().nullable(),
  cameraLens: z.string().nullable(),
  lighting: z.string().nullable(),
  imagePrompt: z.string().nullable(),
  videoPrompt: z.string().nullable(),
  musicPromptHint: z.string().nullable(),
  sfxHints: z.array(z.string()),
  transitionIn: z.string().nullable(),
  transitionOut: z.string().nullable(),
  status: SceneStatus,
  selectedImage: AssetRef.nullable(),
  selectedVideo: AssetRef.nullable(),
  selectedLipSync: AssetRef.nullable(),
  locales: z.array(SceneLocaleView),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type SceneView = z.infer<typeof SceneView>;

/** POST /v1/projects/:id/scenes/:idx/regenerate */
export const RegenerateSceneInput = z
  .object({
    kind: z.enum(['IMAGE', 'VIDEO', 'VOICE', 'LIPSYNC']),
    locale: z.string().optional(),
    promptOverride: z.string().max(2000).optional(),
    seed: z.number().int().optional(),
    parameters: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.kind === 'VOICE' || val.kind === 'LIPSYNC') && !val.locale) {
      ctx.addIssue({
        code: 'custom',
        path: ['locale'],
        message: 'locale is required when kind is VOICE or LIPSYNC',
      });
    }
  });
export type RegenerateSceneInput = z.infer<typeof RegenerateSceneInput>;

export const RegenerateSceneResponse = z.object({
  jobId: Cuid,
  sceneId: Cuid,
  kind: z.string(),
});
export type RegenerateSceneResponse = z.infer<typeof RegenerateSceneResponse>;
