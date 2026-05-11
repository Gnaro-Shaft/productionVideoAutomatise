import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateRenderInput } from '@pva/shared-types';
import type { AuthContext } from '../../common/decorators/auth.decorator';
import { PrismaService } from '../../infra/prisma.service';
import { TemporalService } from '../../infra/temporal.service';

const ORCHESTRATOR_QUEUE = 'pva-orchestrator';

@Injectable()
export class RendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporal: TemporalService,
  ) {}

  async create(projectId: string, input: CreateRenderInput, auth: AuthContext) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, orgId: auth.orgId, deletedAt: null },
    });
    if (!project) throw new NotFoundException();

    let render;
    try {
      render = await this.prisma.render.create({
        data: {
          projectId,
          locale: input.locale,
          format: input.format,
          status: 'PENDING',
        },
      });
    } catch (err) {
      throw new ConflictException(
        `Render already exists for (${input.locale}, ${input.format})`,
      );
    }

    // Trigger the render workflow with the new Render id.
    await this.temporal.client.workflow.start('renderProjectWorkflow', {
      args: [{ renderId: render.id }],
      taskQueue: ORCHESTRATOR_QUEUE,
      workflowId: `render-${render.id}`,
    });

    return render;
  }

  async list(projectId: string, auth: AuthContext) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, orgId: auth.orgId, deletedAt: null },
    });
    if (!project) throw new NotFoundException();

    return this.prisma.render.findMany({
      where: { projectId },
      include: { outputAsset: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, auth: AuthContext) {
    const render = await this.prisma.render.findFirst({
      where: { id, project: { orgId: auth.orgId, deletedAt: null } },
      include: { outputAsset: true },
    });
    if (!render) throw new NotFoundException();
    return render;
  }
}
