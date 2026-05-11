import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env from workspace root (this file: apps/api-gateway/src/config/env.ts → ../../../../.env)
loadDotenv({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') });

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

  LOCAL_ORG_ID: z.string().optional(),
  LOCAL_USER_ID: z.string().optional(),

  API_PORT: z.coerce.number().default(4000),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export const env = Env.parse(process.env);
