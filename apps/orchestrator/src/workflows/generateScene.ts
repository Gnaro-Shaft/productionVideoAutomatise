import { log, proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const dbAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-db',
  startToCloseTimeout: '10 seconds',
  retry: { initialInterval: '1s', maximumAttempts: 10, backoffCoefficient: 2 },
});

const imageAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-image',
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '5s', maximumAttempts: 3, backoffCoefficient: 2 },
});

const videoAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-video',
  startToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 1 }, // Don't retry — slow on Mac, would block everything
});

const voiceAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-voice',
  startToCloseTimeout: '3 minutes',
  retry: { initialInterval: '5s', maximumAttempts: 3, backoffCoefficient: 2 },
});

// const lipsyncAct = proxyActivities<typeof activities>({
//   taskQueue: 'pva-lipsync',
//   startToCloseTimeout: '10 minutes',
//   retry: { initialInterval: '30s', maximumAttempts: 2, backoffCoefficient: 2 },
// });

export interface GenerateSceneInput {
  projectId: string;
  sceneId: string;
}

/**
 * Per-scene child workflow.
 * Activities load their inputs (prompts, locales, scene config) from DB by sceneId,
 * keeping the workflow code minimal and deterministic.
 */
export async function generateSceneWorkflow(input: GenerateSceneInput): Promise<void> {
  const { projectId, sceneId } = input;

  await dbAct.markSceneStatus({ projectId, sceneId, status: 'GENERATING' });

  // 1. Image (anchor for the video clip)
  const image = await imageAct.genImage({ sceneId });

  // 2. Video clip from image — deferred to the background `enhanceWithVideoWorkflow`.
  //    Main path ships Ken Burns master in ~5 min; LTX clips replace them in v2 later.
  void videoAct; // keep import alive — enhance workflow uses the same activity

  // 3. Voice per locale — V1: source locale only.
  //    Iterating SceneLocale[] will be done once translate + multilingual is wired.
  await voiceAct.genVoice({ sceneId, locale: 'fr-FR' });

  // 4. Lip-sync — only when dialogue + face detected (V1.5)
  // await lipsyncAct.runLipSync({ sceneId, videoAssetId: video.assetId, voiceAssetId: voice.assetId });

  await dbAct.markSceneStatus({ projectId, sceneId, status: 'READY' });
}
