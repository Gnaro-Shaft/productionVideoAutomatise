import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { RedisService } from '../../infra/redis.service';

const CACHE_PREFIX = 'idemp-api:';
const TTL_SEC = 24 * 60 * 60; // 24h

/**
 * If the client sends `Idempotency-Key`, the same key replays the cached response
 * for 24h instead of re-executing the handler.
 *
 * Usage: `@UseInterceptors(IdempotencyInterceptor)` on POST endpoints.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const rawKey = req.headers['idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      return next.handle();
    }

    const cached = await this.redis.client().get(CACHE_PREFIX + rawKey);
    if (cached) {
      const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
      res.code(status);
      return of(body);
    }

    return next.handle().pipe(
      tap(async (body) => {
        await this.redis.client().set(
          CACHE_PREFIX + rawKey,
          JSON.stringify({ status: res.statusCode ?? 200, body }),
          'EX',
          TTL_SEC,
        );
      }),
    );
  }
}
