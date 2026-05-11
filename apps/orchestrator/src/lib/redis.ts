import IORedis from 'ioredis';
import { env } from '../config';

let _redis: IORedis | undefined;

export function redis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }
  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = undefined;
  }
}
