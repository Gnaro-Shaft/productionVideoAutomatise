import { z } from 'zod';
import { AssetKind } from '../enums';
import { Cuid, IsoDateTime } from './common';

/**
 * Lightweight reference embedded in scene/render views.
 * `url` is a signed S3 URL when the response includes one.
 */
export const AssetRef = z.object({
  id: Cuid,
  kind: AssetKind,
  version: z.number().int().min(1),
  mime: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  url: z.string().url().nullable(),
});
export type AssetRef = z.infer<typeof AssetRef>;

/** Full asset metadata (GET /v1/assets/:id). */
export const AssetDetail = AssetRef.extend({
  projectId: Cuid,
  sceneId: Cuid.nullable(),
  s3Key: z.string(),
  sizeBytes: z.number().int(),
  checksum: z.string(),
  modelName: z.string().nullable(),
  modelVersion: z.string().nullable(),
  workflowRef: z.string().nullable(),
  promptUsed: z.string().nullable(),
  seed: z.number().int().nullable(),
  parameters: z.record(z.unknown()).nullable(),
  createdAt: IsoDateTime,
});
export type AssetDetail = z.infer<typeof AssetDetail>;

/** GET /v1/assets/:id/url */
export const SignedUrlResponse = z.object({
  url: z.string().url(),
  expiresAt: IsoDateTime,
});
export type SignedUrlResponse = z.infer<typeof SignedUrlResponse>;
