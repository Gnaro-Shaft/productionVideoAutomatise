import { executeChild, log, proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { renderProjectWorkflow } from './renderProject';

const dbAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-db',
  startToCloseTimeout: '10 seconds',
  retry: { initialInterval: '1s', maximumAttempts: 5, backoffCoefficient: 2 },
});

const videoAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-video',
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 1 }, // LTX is slow + flaky on M5 Pro — fail fast, move on
});

export interface EnhanceWithVideoInput {
  projectId: string;
  sceneIds: string[];
}

/**
 * Background enhancement: generates LTX-Video clips for each scene SEQUENTIALLY
 * (ComfyUI processes one prompt at a time on M5 Pro), then re-renders the master.
 *
 * Kicked off as a detached child workflow at the end of produceVideo so the user
 * gets a Ken Burns master quickly while the higher-quality version cooks in the
 * background. Failures per scene are tolerated — the master is re-rendered with
 * whatever video clips succeeded, falling back to Ken Burns for the rest.
 */
export async function enhanceWithVideoWorkflow(input: EnhanceWithVideoInput): Promise<void> {
  const { projectId, sceneIds } = input;
  log.info('enhance: starting background video enhancement', {
    projectId,
    sceneCount: sceneIds.length,
  });

  let succeeded = 0;
  for (const sceneId of sceneIds) {
    try {
      await videoAct.genVideo({ sceneId });
      succeeded++;
      log.info('enhance: scene video generated', { sceneId, succeeded });
    } catch (err) {
      log.warn('enhance: scene video failed — skipping (Ken Burns fallback will apply)', {
        sceneId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (succeeded === 0) {
    log.warn('enhance: zero scenes produced video — skipping master re-render', { projectId });
    return;
  }

  log.info('enhance: re-rendering master with new video clips', { projectId, succeeded });
  const renders = await dbAct.listRendersForProject({ projectId });
  await Promise.all(
    renders.map((r) =>
      executeChild(renderProjectWorkflow, {
        args: [{ renderId: r.id }],
        workflowId: `render-enhance-${r.id}-${Date.now()}`,
      }),
    ),
  );

  log.info('enhance: completed', { projectId, succeeded });
}
