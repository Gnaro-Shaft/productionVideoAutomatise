import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

loadDotenv({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const Env = z.object({
  RENDER_SVC_PORT: z.coerce.number().default(7007),
  RENDER_TMP_DIR: z.string().default('/tmp/pva-renders'),
});

export const env = Env.parse(process.env);
