import { ApplicationFailure } from '@temporalio/activity';
import { RenderClient, type SceneInput } from '../clients/render';
import { db } from '../lib/db';
import { publishWsEvent } from '../lib/progress';
import { signedDownloadUrl, uploadAsset } from '../lib/storage';

const renderClient = new RenderClient();

/**
 * Ensures a default Render row exists for (projectId, sourceLocale, projectFormat).
 * Called once after scenes are generated, before render fan-out.
 */
export async function ensureDefaultRender(input: {
  projectId: string;
}): Promise<{ renderId: string }> {
  const project = await db().project.findUnique({ where: { id: input.projectId } });
  if (!project) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Project ${input.projectId} not found`,
      nonRetryable: true,
    });
  }

  const existing = await db().render.findFirst({
    where: {
      projectId: project.id,
      locale: project.sourceLocale,
      format: project.format,
    },
  });
  if (existing) return { renderId: existing.id };

  const created = await db().render.create({
    data: {
      projectId: project.id,
      locale: project.sourceLocale,
      format: project.format,
      status: 'PENDING',
    },
  });
  return { renderId: created.id };
}

/**
 * Runs an end-to-end render:
 *   1. Loads Render + Project + Scenes + voice assets for the target locale.
 *   2. Generates signed S3 URLs for each scene's image + voice.
 *   3. Calls render-svc which bundles + renders the Remotion composition.
 *   4. Uploads the resulting MP4 to MinIO.
 *   5. Creates an Asset (kind=MASTER_VIDEO) and updates Render.outputAssetId.
 *   6. Publishes a WS render.status COMPLETED event.
 */
export async function runRender(input: {
  renderId: string;
}): Promise<{ assetId: string }> {
  const render = await db().render.findUnique({
    where: { id: input.renderId },
    include: {
      project: {
        include: {
          scenes: {
            orderBy: { idx: 'asc' },
            include: {
              selectedImage: true,
            },
          },
        },
      },
    },
  });
  if (!render) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Render ${input.renderId} not found`,
      nonRetryable: true,
    });
  }

  await db().render.update({
    where: { id: render.id },
    data: { status: 'RENDERING', startedAt: new Date() },
  });

  await publishWsEvent(render.projectId, {
    type: 'render.status',
    data: {
      projectId: render.projectId,
      renderId: render.id,
      status: 'RENDERING',
      progress: 0.85,
    },
  });

  // Build the scene inputs with signed URLs (30 min TTL — covers render time).
  const sceneInputs: SceneInput[] = [];
  for (const scene of render.project.scenes) {
    const sceneLocale = await db().sceneLocale.findFirst({
      where: { sceneId: scene.id, locale: render.locale },
      include: { voiceAsset: true },
    });
    if (!scene.selectedImage) {
      throw ApplicationFailure.create({
        type: 'ValidationError',
        message: `Scene ${scene.id} (idx ${scene.idx}) has no selectedImage`,
        nonRetryable: true,
      });
    }

    const imageUrl = await signedDownloadUrl(
      scene.selectedImage.s3Bucket,
      scene.selectedImage.s3Key,
    );

    // Pull the LTX-Video clip if one exists for this scene.
    const videoAsset = await db().asset.findFirst({
      where: {
        projectId: scene.projectId,
        sceneId: scene.id,
        kind: 'VIDEO_CLIP',
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
    });
    const videoUrl = videoAsset
      ? await signedDownloadUrl(videoAsset.s3Bucket, videoAsset.s3Key)
      : null;
    const videoDurationSec = videoAsset?.durationMs
      ? videoAsset.durationMs / 1000
      : null;

    const audioUrl = sceneLocale?.voiceAsset
      ? await signedDownloadUrl(
          sceneLocale.voiceAsset.s3Bucket,
          sceneLocale.voiceAsset.s3Key,
        )
      : null;

    sceneInputs.push({
      imageUrl,
      videoUrl,
      videoDurationSec,
      audioUrl,
      durationSec: scene.durationSec,
      voiceText: sceneLocale?.voiceText,
    });
  }

  // Look up the project-level music asset if it exists.
  const musicAsset = await db().asset.findFirst({
    where: {
      projectId: render.projectId,
      kind: 'PROJECT_MUSIC',
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
  const musicUrl = musicAsset
    ? await signedDownloadUrl(musicAsset.s3Bucket, musicAsset.s3Key)
    : null;

  // Call render-svc — returns MP4 bytes.
  let mp4: Buffer;
  try {
    mp4 = await renderClient.render({
      scenes: sceneInputs,
      format: render.format as string,
      musicUrl,
    });
  } catch (err) {
    await db().render.update({
      where: { id: render.id },
      data: {
        status: 'FAILED',
        errorMessage: (err as Error).message,
        finishedAt: new Date(),
      },
    });
    throw err;
  }

  // Compute next version: re-renders (enhance workflow) bump v1 -> v2 -> v3 ...
  const previousMaster = await db().asset.findFirst({
    where: {
      projectId: render.projectId,
      kind: 'MASTER_VIDEO',
      sceneId: null,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (previousMaster?.version ?? 0) + 1;

  // Upload to MinIO — version suffix keeps each render distinct in storage.
  const s3Key = `projects/${render.projectId}/renders/${render.id}-v${nextVersion}.mp4`;
  const upload = await uploadAsset({
    key: s3Key,
    body: mp4,
    mime: 'video/mp4',
  });

  // Compute total duration from scene durations.
  const durationSec = sceneInputs.reduce(
    (sum, s) => sum + Math.max(0, s.durationSec),
    0,
  );

  // Atomically: create MASTER_VIDEO asset + link the Render to it.
  const asset = await db().$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        projectId: render.projectId,
        sceneId: null,
        kind: 'MASTER_VIDEO',
        version: nextVersion,
        s3Bucket: upload.bucket,
        s3Key: upload.key,
        mime: 'video/mp4',
        sizeBytes: upload.sizeBytes,
        checksum: upload.checksum,
        durationMs: Math.round(durationSec * 1000),
        modelName: 'remotion',
        modelVersion: '4.0',
        workflowRef: 'render_story.v1',
      },
    });

    await tx.render.update({
      where: { id: render.id },
      data: {
        status: 'COMPLETED',
        outputAssetId: created.id,
        durationSec: Math.round(durationSec),
        codec: 'h264',
        fps: 30,
        finishedAt: new Date(),
      },
    });

    return created;
  });

  await publishWsEvent(render.projectId, {
    type: 'render.status',
    data: {
      projectId: render.projectId,
      renderId: render.id,
      status: 'COMPLETED',
      progress: 1.0,
    },
  });

  return { assetId: asset.id };
}
