import { PrismaClient } from '@prisma/client';
import { env } from '../config';

let _prisma: PrismaClient | undefined;

export function db(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: env.LOG_LEVEL === 'debug' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return _prisma;
}

export async function disconnectDb(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}
