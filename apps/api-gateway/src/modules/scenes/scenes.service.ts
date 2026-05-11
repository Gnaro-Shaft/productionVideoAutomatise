import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { AuthContext } from '../../common/decorators/auth.decorator';
import { PrismaService } from '../../infra/prisma.service';

@Injectable()
export class ScenesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, auth: AuthContext) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, orgId: auth.orgId, deletedAt: null },
    });
    if (!project) throw new NotFoundException();

    return this.prisma.scene.findMany({
      where: { projectId },
      orderBy: { idx: 'asc' },
      include: {
        selectedImage: true,
        selectedVideo: true,
        selectedLipSync: true,
        locales: { include: { voiceAsset: true, lipSyncAsset: true, subtitleAsset: true } },
      },
    });
  }

  async get(projectId: string, idx: number, auth: AuthContext) {
    const scene = await this.prisma.scene.findFirst({
      where: { projectId, idx, project: { orgId: auth.orgId, deletedAt: null } },
      include: {
        selectedImage: true,
        selectedVideo: true,
        selectedLipSync: true,
        locales: { include: { voiceAsset: true, lipSyncAsset: true, subtitleAsset: true } },
      },
    });
    if (!scene) throw new NotFoundException();
    return scene;
  }

  /**
   * V1 stub — needs a `regenerateAssetWorkflow` in the orchestrator.
   * Currently returns 501; design is in conversation history.
   */
  async regenerate(_projectId: string, _idx: number, _input: unknown, _auth: AuthContext) {
    throw new NotImplementedException(
      'Scene regeneration workflow not yet wired (TODO: regenerateAssetWorkflow)',
    );
  }
}
