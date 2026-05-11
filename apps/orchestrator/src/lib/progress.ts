import type { WsEventEnvelope } from '@pva/shared-types';
import { redis } from './redis';

/**
 * Publishes a typed WS event to the project channel.
 * The api-gateway is subscribed to `project:*` and forwards to socket.io rooms.
 */
export async function publishWsEvent(
  projectId: string,
  event: WsEventEnvelope,
): Promise<void> {
  const channel = `project:${projectId}`;
  await redis().publish(channel, JSON.stringify(event));
}
