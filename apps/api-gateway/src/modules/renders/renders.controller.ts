import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateRenderInput } from '@pva/shared-types';
import { createZodDto } from 'nestjs-zod';
import { Auth, type AuthContext } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RendersService } from './renders.service';

class CreateRenderDto extends createZodDto(CreateRenderInput) {}

@ApiTags('renders')
@UseGuards(AuthGuard)
@Controller()
export class RendersController {
  constructor(private readonly renders: RendersService) {}

  @Post('projects/:projectId/renders')
  @ApiOperation({ summary: 'Request a new render (locale × format)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateRenderDto,
    @Auth() auth: AuthContext,
  ) {
    return this.renders.create(projectId, dto, auth);
  }

  @Get('projects/:projectId/renders')
  @ApiOperation({ summary: 'List renders for a project' })
  list(@Param('projectId') projectId: string, @Auth() auth: AuthContext) {
    return this.renders.list(projectId, auth);
  }

  @Get('renders/:id')
  @ApiOperation({ summary: 'Get one render' })
  get(@Param('id') id: string, @Auth() auth: AuthContext) {
    return this.renders.get(id, auth);
  }
}
