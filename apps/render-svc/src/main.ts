import express from 'express';
import { env } from './config';
import { warmUp } from './render';
import router from './routes';

async function main() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(router);

  // Pre-bundle Remotion + download Chromium so first /render is fast.
  await warmUp();

  app.listen(env.RENDER_SVC_PORT, '0.0.0.0', () => {
    console.log(
      `[render-svc] listening on http://localhost:${env.RENDER_SVC_PORT}`,
    );
  });
}

main().catch((err) => {
  console.error('[render-svc] fatal:', err);
  process.exit(1);
});
