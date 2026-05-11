import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { S3Service } from './s3.service';
import { TemporalService } from './temporal.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, TemporalService, S3Service],
  exports: [PrismaService, RedisService, TemporalService, S3Service],
})
export class InfraModule {}
