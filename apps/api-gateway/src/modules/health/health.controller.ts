import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  health(): { ok: true; version: string; uptime: number } {
    return {
      ok: true,
      version: process.env.npm_package_version ?? '0.0.1',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}
