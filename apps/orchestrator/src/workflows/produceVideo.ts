import {
  ApplicationFailure,
  defineQuery,
  defineSignal,
  executeChild,
  ParentClosePolicy,
  proxyActivities,
  setHandler,
  startChild,
} from '@temporalio/workflow';
import type * as activities from '../activities';
import { enhanceWithVideoWorkflow } from './enhanceWithVideo';
import { generateProjectMusicWorkflow } from './generateMusic';
import { generateSceneWorkflow } from './generateScene';
import { renderProjectWorkflow } from './renderProject';

// ── Activity proxies (one per task queue) ────────────────────────────

const planner = proxyActivities<typeof activities>({
  taskQueue: 'pva-planner',
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5s',
    maximumInterval: '2 minutes',
    backoffCoefficient: 2,
    maximumAttempts: 3,
    nonRetryableErrorTypes: ['NotImplemented', 'ValidationError', 'PromptRefusedError'],
  },
});

const dbAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-db',
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 10,
  },
});

const imageAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-image',
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 2 },
});

// ── Signals & queries ────────────────────────────────────────────────

export const cancelSignal = defineSignal('cancel');
export const regenerateSignal = defineSignal<
  [{ sceneIdx: number; kind: 'IMAGE' | 'VIDEO' | 'VOICE' | 'LIPSYNC'; locale?: string }]
>('regenerateAsset');
export const progressQuery = defineQuery<{ progress: number; phase: string }>('progress');

// ── Workflow ─────────────────────────────────────────────────────────

export interface ProduceVideoInput {
  projectId: string;
}

export async function produceVideoWorkflow(input: ProduceVideoInput): Promise<void> {
  const { projectId } = input;
  let cancelled = false;
  const progress = { progress: 0, phase: 'init' };

  setHandler(cancelSignal, () => {
    cancelled = true;
  });
  setHandler(progressQuery, () => progress);

  try {
    // 1. Plan script
    progress.progress = 0.05;
    progress.phase = 'planning';
    await dbAct.markStatus({ projectId, status: 'PLANNING', progress: 0.05 });

    const { scriptJson } = await planner.planScript({ projectId });
    if (cancelled) throw ApplicationFailure.create({ message: 'Cancelled by user' });

    // 2. Storyboard → creates Scene rows in DB
    progress.progress = 0.1;
    progress.phase = 'storyboard';
    const { sceneIds } = await planner.generateStoryboard({ projectId, scriptJson });

    if (cancelled) throw ApplicationFailure.create({ message: 'Cancelled by user' });

    // 3a. Fan-out: 1 child WF per scene (FLUX + voice in parallel).
    progress.progress = 0.15;
    progress.phase = 'generating';
    await dbAct.markStatus({ projectId, status: 'GENERATING', progress: 0.15 });

    const sceneTasks = sceneIds.map((sceneId) =>
      executeChild(generateSceneWorkflow, {
        args: [{ projectId, sceneId }],
        workflowId: `scene-${sceneId}`,
      }),
    );
    await Promise.all(sceneTasks);
    if (cancelled) throw ApplicationFailure.create({ message: 'Cancelled by user' });

    // 3b. Free FLUX from ComfyUI memory before MusicGen loads (~22 GB freed on M5 Pro).
    //     Best-effort — if ComfyUI doesn't respond, we still proceed.
    await imageAct.unloadComfyModels();

    // 3c. Generate project music SEQUENTIALLY (after scenes, so MusicGen has room).
    progress.progress = 0.7;
    progress.phase = 'music';
    await dbAct.markStatus({ projectId, status: 'GENERATING', progress: 0.7 });

    await executeChild(generateProjectMusicWorkflow, {
      args: [{ projectId }],
      workflowId: `music-${projectId}`,
    });
    if (cancelled) throw ApplicationFailure.create({ message: 'Cancelled by user' });

    // 4. Auto-create a default render (sourceLocale × project.format) if none exists.
    await dbAct.ensureDefaultRender({ projectId });

    progress.progress = 0.85;
    progress.phase = 'rendering';
    await dbAct.markStatus({ projectId, status: 'RENDERING', progress: 0.85 });

    const renders = await dbAct.listRendersForProject({ projectId });
    await Promise.all(
      renders.map((r) =>
        executeChild(renderProjectWorkflow, {
          args: [{ renderId: r.id }],
          workflowId: `render-${r.id}`,
        }),
      ),
    );

    // 5. Done — master v1 is ready (Ken Burns).
    progress.progress = 1;
    progress.phase = 'completed';
    await dbAct.markCompleted({ projectId });

    // 6. Kick off background video enhancement (detached child workflow).
    //    Generates LTX clips per scene, then re-renders master v2.
    //    Parent completes immediately — child runs independently and may take hours.
    await startChild(enhanceWithVideoWorkflow, {
      args: [{ projectId, sceneIds }],
      workflowId: `enhance-${projectId}`,
      parentClosePolicy: ParentClosePolicy.ABANDON,
    });
  } catch (err) {
    const reason = cancelled
      ? 'Cancelled by user'
      : err instanceof Error
        ? err.message
        : 'Unknown error';
    await dbAct.markFailed({ projectId, reason });
    throw err;
  }
}
