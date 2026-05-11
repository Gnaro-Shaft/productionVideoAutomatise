import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegenerateSceneInput } from '@pva/shared-types';
import { createZodDto } from 'nestjs-zod';
import { Auth, type AuthContext } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ScenesService } from './scenes.service';

class RegenerateSceneDto extends createZodDto(RegenerateSceneInput) {}

@ApiTags('scenes')
@Controller('projects/:projectId/scenes')
@UseGuards(AuthGuard)
export class ScenesController {
  constructor(private readonly scenes: ScenesService) {}

  @Get()
  @ApiOperation({ summary: 'List scenes of a project' })
  list(@Param('projectId') projectId: string, @Auth() auth: AuthContext) {
    return this.scenes.list(projectId, auth);
  }

  @Get(':idx')
  @ApiOperation({ summary: 'Get one scene by index' })
  get(
    @Param('projectId') projectId: string,
    @Param('idx', ParseIntPipe) idx: number,
    @Auth() auth: AuthContext,
  ) {
    return this.scenes.get(projectId, idx, auth);
  }

  @Post(':idx/regenerate')
  @ApiOperation({ summary: 'Regenerate one asset for a scene (501 in V1)' })
  regenerate(
    @Param('projectId') projectId: string,
    @Param('idx', ParseIntPipe) idx: number,
    @Body() dto: RegenerateSceneDto,
    @Auth() auth: AuthContext,
  ) {
    return this.scenes.regenerate(projectId, idx, dto, auth);
  }
}
