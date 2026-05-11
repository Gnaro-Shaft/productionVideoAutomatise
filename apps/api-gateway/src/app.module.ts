import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { InfraModule } from './infra/infra.module';
import { AssetsModule } from './modules/assets/assets.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RendersModule } from './modules/renders/renders.module';
import { ScenesModule } from './modules/scenes/scenes.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [
    InfraModule,
    HealthModule,
    ProjectsModule,
    ScenesModule,
    AssetsModule,
    RendersModule,
    WsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
