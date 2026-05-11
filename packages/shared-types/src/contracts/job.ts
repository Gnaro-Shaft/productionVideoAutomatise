import { z } from 'zod';
import { JobKind, JobStatus } from '../enums';
import { Cuid, IsoDateTime } from './common';

/** GET /v1/projects/:id/jobs — debug/observability */
export const JobView = z.object({
  id: Cuid,
  projectId: Cuid,
  sceneId: Cuid.nullable(),
  kind: JobKind,
  status: JobStatus,
  modelName: z.string().nullable(),
  modelVersion: z.string().nullable(),
  workflowRef: z.string().nullable(),
  gpuSeconds: z.number().int(),
  attempts: z.number().int(),
  errorMessage: z.string().nullable(),
  startedAt: IsoDateTime.nullable(),
  finishedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type JobView = z.infer<typeof JobView>;
