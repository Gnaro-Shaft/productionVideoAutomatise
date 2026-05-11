import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const musicAct = proxyActivities<typeof activities>({
  taskQueue: 'pva-music',
  startToCloseTimeout: '5 minutes',
  retry: { initialInterval: '10s', maximumAttempts: 3, backoffCoefficient: 2 },
});

export interface GenerateMusicInput {
  projectId: string;
}

/**
 * Generates the project-level music track in parallel with scene generation.
 * Activity reads Project for the desired mood / duration / style.
 */
export async function generateProjectMusicWorkflow(input: GenerateMusicInput): Promise<void> {
  const { projectId } = input;
  await musicAct.genMusic({ projectId });
}
