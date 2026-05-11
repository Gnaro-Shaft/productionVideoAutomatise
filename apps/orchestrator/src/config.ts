import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env from the workspace root (this file is at apps/orchestrator/src/config.ts)
loadDotenv({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const Env = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_BUCKET: z.string().default('pva-assets'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_REGION: z.string().default('us-east-1'),

  COMFY_URL: z.string().default('http://localhost:8188'),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
  PLANNER_SVC_URL: z.string().default('http://localhost:7001'),
  VOICE_SVC_URL: z.string().default('http://localhost:7002'),
  RENDER_SVC_URL: z.string().default('http://localhost:7007'),
  MUSIC_SVC_URL: z.string().default('http://localhost:7003'),
  SFX_SVC_URL: z.string().default('http://localhost:7004'),
  LIPSYNC_SVC_URL: z.string().default('http://localhost:7005'),
  TRANSLATE_SVC_URL: z.string().default('http://localhost:7006'),

  LOCAL_ORG_ID: z.string().optional(),
  LOCAL_USER_ID: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  QUEUES: z.string().default('all'),
});

export const env = Env.parse(process.env);

/**
 * Single source of truth for Temporal task queue names.
 * One queue per service, so workers scale independently.
 */
export const TASK_QUEUES = {
  orchestrator: 'pva-orchestrator',
  db: 'pva-db',
  planner: 'pva-planner',
  image: 'pva-image',
  video: 'pva-video',
  voice: 'pva-voice',
  music: 'pva-music',
  sfx: 'pva-sfx',
  lipsync: 'pva-lipsync',
  render: 'pva-render',
  storage: 'pva-storage',
} as const;

export type TaskQueueKey = keyof typeof TASK_QUEUES;
