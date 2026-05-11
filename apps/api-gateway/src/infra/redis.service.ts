import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { env } from '../config/env';

/**
 * Provides two ioredis connections:
 *  - `client()` for normal commands (cache, idempotency)
 *  - `subscriber()` for pub/sub (separate connection per ioredis recommendation)
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private _client?: Redis;
  private _subscriber?: Redis;

  client(): Redis {
    if (!this._client) {
      this._client = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    }
    return this._client;
  }

  subscriber(): Redis {
    if (!this._subscriber) {
      this._subscriber = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    }
    return this._subscriber;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this._client?.quit(), this._subscriber?.quit()]);
  }
}
