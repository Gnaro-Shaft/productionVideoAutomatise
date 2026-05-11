import { env, TASK_QUEUES, type TaskQueueKey } from './config';
import { disconnectDb } from './lib/db';
import { disconnectRedis } from './lib/redis';
import { startWorker } from './workers/start';

const ALL_QUEUES = Object.keys(TASK_QUEUES) as TaskQueueKey[];

function parseQueues(): TaskQueueKey[] {
  const requested = env.QUEUES.split(',').map((s) => s.trim());
  if (requested.includes('all') || requested[0] === '') {
    return ALL_QUEUES;
  }
  return requested.filter((q): q is TaskQueueKey => q in TASK_QUEUES);
}

async function main(): Promise<void> {
  const queues = parseQueues();
  if (queues.length === 0) {
    throw new Error(`No valid queues parsed from QUEUES="${env.QUEUES}"`);
  }
  // eslint-disable-next-line no-console
  console.log(`[orchestrator] starting workers for queues: ${queues.join(', ')}`);
  await Promise.all(queues.map((q) => startWorker(q)));
}

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[orchestrator] received ${signal}, shutting down...`);
  await Promise.allSettled([disconnectDb(), disconnectRedis()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[orchestrator] fatal:', err);
  process.exit(1);
});
