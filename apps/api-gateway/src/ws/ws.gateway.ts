import {
  Inject,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { WsEventEnvelope } from '@pva/shared-types';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../infra/redis.service';

const REDIS_CHANNEL_PATTERN = 'project:*';

@WebSocketGateway({
  // origin: '*' must NOT be combined with credentials: true (browsers reject).
  // Sockets in V1 don't carry auth cookies, so credentials stays off.
  cors: { origin: '*' },
  path: '/ws',
})
export class WsGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WsGateway');

  @WebSocketServer()
  private server!: Server;

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    const sub = this.redis.subscriber();
    await sub.psubscribe(REDIS_CHANNEL_PATTERN);
    sub.on('pmessage', (_pattern, channel, raw) => {
      const projectId = channel.split(':')[1];
      if (!projectId) return;
      try {
        const event = JSON.parse(raw) as WsEventEnvelope;
        this.server.to(`project:${projectId}`).emit('event', event);
      } catch (err) {
        this.logger.warn(`bad pubsub payload on ${channel}: ${(err as Error).message}`);
      }
    });
    this.logger.log(`subscribed to redis ${REDIS_CHANNEL_PATTERN}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.subscriber().punsubscribe(REDIS_CHANNEL_PATTERN).catch(() => {});
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId?: string },
  ): { ok: boolean; error?: string } {
    if (!body?.projectId) return { ok: false, error: 'projectId required' };
    client.join(`project:${body.projectId}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId?: string },
  ): { ok: boolean } {
    if (body?.projectId) client.leave(`project:${body.projectId}`);
    return { ok: true };
  }
}
