import { z } from 'zod';
import { Format, Locale, RenderStatus } from '../enums';
import { AssetRef } from './asset';
import { Cuid, IsoDateTime } from './common';

/** POST /v1/projects/:id/renders */
export const CreateRenderInput = z.object({
  locale: Locale,
  format: Format,
});
export type CreateRenderInput = z.infer<typeof CreateRenderInput>;

export const RenderSummary = z.object({
  id: Cuid,
  projectId: Cuid,
  locale: z.string(),
  format: Format,
  status: RenderStatus,
  durationSec: z.number().int().nullable(),
  resolution: z.string().nullable(),
  codec: z.string().nullable(),
  fps: z.number().int().nullable(),
  bitrateKbps: z.number().int().nullable(),
  outputAsset: AssetRef.nullable(),
  errorMessage: z.string().nullable(),
  startedAt: IsoDateTime.nullable(),
  finishedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type RenderSummary = z.infer<typeof RenderSummary>;
