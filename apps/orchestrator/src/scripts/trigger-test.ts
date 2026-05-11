/**
 * Smoke test: creates a fresh project in DB, then starts the workflow.
 * Expected behavior with V1 stubs:
 *   - Project goes to PLANNING in DB ✓
 *   - WS event project.status published to Redis ✓
 *   - planScript activity throws NotImplemented ✗ (expected)
 *   - markFailed runs, Project goes to FAILED ✓
 *
 * Run:   pnpm --filter @pva/orchestrator trigger:test
 */
import { env, TASK_QUEUES } from '../config';
import { db, disconnectDb } from '../lib/db';
import { temporalClient } from '../lib/temporal';

async function main(): Promise<void> {
  if (!env.LOCAL_ORG_ID || !env.LOCAL_USER_ID) {
    throw new Error(
      'LOCAL_ORG_ID / LOCAL_USER_ID missing in .env — run `pnpm db:seed` first',
    );
  }

  const project = await db().project.create({
    data: {
      orgId: env.LOCAL_ORG_ID,
      createdById: env.LOCAL_USER_ID,
      title: `Smoke test ${new Date().toISOString()}`,
      userPrompt: 'Smoke test workflow connectivity — expected to fail at planScript stub',
      sourceLocale: 'fr-FR',
      durationTargetSec: 30,
    },
  });
  console.log(`[trigger] created project: ${project.id}`);

  const client = await temporalClient();
  const handle = await client.workflow.start('produceVideoWorkflow', {
    args: [{ projectId: project.id }],
    taskQueue: TASK_QUEUES.orchestrator,
    workflowId: `produce-${project.id}`,
  });

  console.log(`[trigger] started workflow: ${handle.workflowId}`);
  console.log(
    `[trigger] open in Temporal UI: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}/${handle.firstExecutionRunId}`,
  );
  console.log('[trigger] expected to FAIL at planScript (NotImplemented) — that is correct.');
}

main()
  .then(() => disconnectDb())
  .catch(async (err) => {
    console.error('[trigger] error:', err);
    await disconnectDb();
    process.exit(1);
  });
