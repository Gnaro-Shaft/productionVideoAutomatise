import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const renderAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-render',
  startToCloseTimeout: '30 minutes',
  retry: { maximumAttempts: 1 }, // render is expensive — fail fast, surface errors
  heartbeatTimeout: '60 seconds',
});

export interface RenderProjectInput {
  renderId: string;
}

/**
 * One render = one MP4 file. All assembly happens inside runRender.
 */
export async function renderProjectWorkflow(input: RenderProjectInput): Promise<void> {
  await renderAct.runRender({ renderId: input.renderId });
}
