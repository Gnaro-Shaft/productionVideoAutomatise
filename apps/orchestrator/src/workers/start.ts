import { NativeConnection, Worker } from '@temporalio/worker';
import path from 'node:path';
import * as activities from '../activities';
import { env, TASK_QUEUES, type TaskQueueKey } from '../config';

/**
 * Starts a Temporal worker on the given task queue.
 * Workflows are only registered on the `orchestrator` queue;
 * other queues only execute activities matching them.
 */
export async function startWorker(queueKey: TaskQueueKey): Promise<void> {
  const taskQueue = TASK_QUEUES[queueKey];
  const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });

  const baseOptions = {
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue,
    activities,
  };

  const options =
    queueKey === 'orchestrator'
      ? { ...baseOptions, workflowsPath: path.join(__dirname, '..', 'workflows') }
      : baseOptions;

  const worker = await Worker.create(options);
  // eslint-disable-next-line no-console
  console.log(`[worker] started on queue: ${taskQueue}`);
  await worker.run();
}
