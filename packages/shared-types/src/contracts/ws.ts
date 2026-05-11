import { z } from 'zod';
import { AssetKind, JobKind, ProjectStatus, RenderStatus, SceneStatus } from '../enums';
import { Cuid } from './common';

// Handshake (client → server) -------------------------------------------

export const WsAuthHandshake = z.object({
  token: z.string(),
});
export type WsAuthHandshake = z.infer<typeof WsAuthHandshake>;

export const WsSubscribeInput = z.object({
  projectId: Cuid,
});
export type WsSubscribeInput = z.infer<typeof WsSubscribeInput>;

export const WsUnsubscribeInput = z.object({
  projectId: Cuid,
});
export type WsUnsubscribeInput = z.infer<typeof WsUnsubscribeInput>;

export const WsAck = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});
export type WsAck = z.infer<typeof WsAck>;

// Server → client payloads ----------------------------------------------

export const ProjectStatusPayload = z.object({
  projectId: Cuid,
  status: ProjectStatus,
  progress: z.number().min(0).max(1),
});
export type ProjectStatusPayload = z.infer<typeof ProjectStatusPayload>;

export const ProjectCompletedPayload = z.object({
  projectId: Cuid,
  masterRenderUrl: z.string().url().nullable(),
});
export type ProjectCompletedPayload = z.infer<typeof ProjectCompletedPayload>;

export const ProjectFailedPayload = z.object({
  projectId: Cuid,
  errorMessage: z.string(),
});
export type ProjectFailedPayload = z.infer<typeof ProjectFailedPayload>;

export const SceneStatusPayload = z.object({
  projectId: Cuid,
  sceneId: Cuid,
  idx: z.number().int(),
  status: SceneStatus,
});
export type SceneStatusPayload = z.infer<typeof SceneStatusPayload>;

export const SceneAssetReadyPayload = z.object({
  projectId: Cuid,
  sceneId: Cuid,
  idx: z.number().int(),
  kind: AssetKind,
  assetId: Cuid,
  version: z.number().int(),
  url: z.string().url().nullable(),
});
export type SceneAssetReadyPayload = z.infer<typeof SceneAssetReadyPayload>;

export const RenderStatusPayload = z.object({
  projectId: Cuid,
  renderId: Cuid,
  status: RenderStatus,
  progress: z.number().min(0).max(1),
});
export type RenderStatusPayload = z.infer<typeof RenderStatusPayload>;

export const JobFailedPayload = z.object({
  projectId: Cuid,
  jobId: Cuid,
  kind: JobKind,
  errorMessage: z.string(),
  willRetry: z.boolean(),
});
export type JobFailedPayload = z.infer<typeof JobFailedPayload>;

// Discriminated union — useful for client-side routing and validation -----

export const WsEventEnvelope = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project.status'), data: ProjectStatusPayload }),
  z.object({ type: z.literal('project.completed'), data: ProjectCompletedPayload }),
  z.object({ type: z.literal('project.failed'), data: ProjectFailedPayload }),
  z.object({ type: z.literal('scene.status'), data: SceneStatusPayload }),
  z.object({ type: z.literal('scene.asset_ready'), data: SceneAssetReadyPayload }),
  z.object({ type: z.literal('render.status'), data: RenderStatusPayload }),
  z.object({ type: z.literal('job.failed'), data: JobFailedPayload }),
]);
export type WsEventEnvelope = z.infer<typeof WsEventEnvelope>;
export type WsEventType = WsEventEnvelope['type'];
