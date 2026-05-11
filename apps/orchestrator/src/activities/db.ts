import type { ProjectStatus, SceneStatus } from '@pva/shared-types';
import { db } from '../lib/db';
import { publishWsEvent } from '../lib/progress';

export async function markStatus(input: {
  projectId: string;
  status: ProjectStatus;
  progress: number;
}): Promise<void> {
  await db().project.update({
    where: { id: input.projectId },
    data: { status: input.status as never, updatedAt: new Date() },
  });

  await publishWsEvent(input.projectId, {
    type: 'project.status',
    data: {
      projectId: input.projectId,
      status: input.status,
      progress: input.progress,
    },
  });
}

export async function markSceneStatus(input: {
  projectId: string;
  sceneId: string;
  status: SceneStatus;
}): Promise<void> {
  const scene = await db().scene.update({
    where: { id: input.sceneId },
    data: { status: input.status as never, updatedAt: new Date() },
  });

  await publishWsEvent(input.projectId, {
    type: 'scene.status',
    data: {
      projectId: input.projectId,
      sceneId: input.sceneId,
      idx: scene.idx,
      status: input.status,
    },
  });
}

export async function markCompleted(input: { projectId: string }): Promise<void> {
  await db().project.update({
    where: { id: input.projectId },
    data: { status: 'COMPLETED', updatedAt: new Date() },
  });

  // Surface a master render URL if any (signed-URL generation TODO via storage activity)
  const master = await db().render.findFirst({
    where: { projectId: input.projectId, status: 'COMPLETED' },
    include: { outputAsset: true },
    orderBy: { createdAt: 'desc' },
  });

  await publishWsEvent(input.projectId, {
    type: 'project.completed',
    data: {
      projectId: input.projectId,
      masterRenderUrl: master?.outputAsset
        ? `s3://${master.outputAsset.s3Bucket}/${master.outputAsset.s3Key}`
        : null,
    },
  });
}

export async function markFailed(input: {
  projectId: string;
  reason: string;
}): Promise<void> {
  await db().project.update({
    where: { id: input.projectId },
    data: { status: 'FAILED', updatedAt: new Date() },
  });

  await publishWsEvent(input.projectId, {
    type: 'project.failed',
    data: {
      projectId: input.projectId,
      errorMessage: input.reason,
    },
  });
}

export async function listRendersForProject(input: {
  projectId: string;
}): Promise<Array<{ id: string; locale: string; format: string }>> {
  const renders = await db().render.findMany({
    where: { projectId: input.projectId },
    select: { id: true, locale: true, format: true },
  });
  return renders.map((r) => ({
    id: r.id,
    locale: r.locale,
    format: r.format as string,
  }));
}
