import { io, type Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function connectSocket(): Socket {
  return io(WS_URL, {
    path: '/ws',
    transports: ['websocket', 'polling'],
    auth: { token: 'local' },
  });
}
