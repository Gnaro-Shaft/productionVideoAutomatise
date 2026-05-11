import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, type AuthContext } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { CreateProjectDto, PaginationQueryDto, UpdateProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create a project and start the workflow' })
  create(@Body() dto: CreateProjectDto, @Auth() auth: AuthContext) {
    return this.projects.create(dto, auth);
  }

  @Get()
  @ApiOperation({ summary: 'List projects (paginated)' })
  list(@Query() query: PaginationQueryDto, @Auth() auth: AuthContext) {
    return this.projects.list(auth, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full project detail (scenes + renders)' })
  get(@Param('id') id: string, @Auth() auth: AuthContext) {
    return this.projects.getDetail(id, auth);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project metadata' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Auth() auth: AuthContext,
  ) {
    return this.projects.update(id, dto, auth);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a project' })
  remove(@Param('id') id: string, @Auth() auth: AuthContext) {
    return this.projects.remove(id, auth);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Send cancel signal to running workflow' })
  cancel(@Param('id') id: string, @Auth() auth: AuthContext) {
    return this.projects.cancel(id, auth);
  }
}
