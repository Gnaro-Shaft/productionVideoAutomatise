import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global.filter';
import { env } from './config/env';

patchNestJsSwagger();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true, genReqId: () => randomUUID() }),
    { bufferLogs: false },
  );

  // Security + CORS
  // @ts-ignore - dynamic import to avoid type friction with @fastify/helmet ESM/CJS
  const helmet = (await import('@fastify/helmet')).default;
  await app.register(helmet, { contentSecurityPolicy: false });
  app.enableCors({ origin: env.API_CORS_ORIGIN, credentials: true });

  app.setGlobalPrefix('v1', { exclude: ['ws'] });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useWebSocketAdapter(new IoAdapter(app));

  // OpenAPI
  const openApi = new DocumentBuilder()
    .setTitle('Production Video Automatisé — API')
    .setDescription('REST + WebSocket gateway for the AI video pipeline')
    .setVersion('0.1')
    .addServer(`http://localhost:${env.API_PORT}`)
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });

  await app.listen(env.API_PORT, '0.0.0.0');

  const logger = new Logger('bootstrap');
  logger.log(`api-gateway listening on http://localhost:${env.API_PORT}`);
  logger.log(`OpenAPI docs:           http://localhost:${env.API_PORT}/docs`);
  logger.log(`OpenAPI JSON:           http://localhost:${env.API_PORT}/docs/openapi.json`);
  logger.log(`WebSocket path:         ws://localhost:${env.API_PORT}/ws`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api-gateway] fatal:', err);
  process.exit(1);
});
