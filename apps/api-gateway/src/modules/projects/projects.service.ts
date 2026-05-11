import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectInput,
  PaginationQuery,
  ProjectDetail,
  ProjectSummary,
  UpdateProjectInput,
} from '@pva/shared-types';
import type { AuthContext } from '../../common/decorators/auth.decorator';
import { PrismaService } from '../../infra/prisma.service';
import { TemporalService } from '../../infra/temporal.service';

const ORCHESTRATOR_QUEUE = 'pva-orchestrator';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporal: TemporalService,
  ) {}

  // ── Mutations ─────────────────────────────────────────────────────

  async create(input: CreateProjectInput, auth: AuthContext): Promise<ProjectSummary> {
    const project = await this.prisma.project.create({
      data: {
        orgId: auth.orgId,
        createdById: auth.userId,
        title: input.title,
        userPrompt: input.prompt,
        format: input.format,
        durationTargetSec: input.durationTargetSec,
        sourceLocale: input.sourceLocale,
        targetLocales: input.targetLocales,
        styleHint: input.styleHint ?? null,
        platformHint: input.platformHint ?? null,
      },
    });

    const handle = await this.temporal.client.workflow.start('produceVideoWorkflow', {
      args: [{ projectId: project.id }],
      taskQueue: ORCHESTRATOR_QUEUE,
      workflowId: `produce-${project.id}`,
    });

    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        temporalWorkflowId: handle.workflowId,
        temporalRunId: handle.firstExecutionRunId,
      },
    });

    return this.toSummary(updated);
  }

  async update(
    id: string,
    input: UpdateProjectInput,
    auth: AuthContext,
  ): Promise<ProjectSummary> {
    await this.assertOwned(id, auth);
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        title: input.title ?? undefined,
        styleHint: input.styleHint === null ? null : (input.styleHint ?? undefined),
        platformHint:
          input.platformHint === null ? null : (input.platformHint ?? undefined),
        targetLocales: input.targetLocales ?? undefined,
      },
    });
    return this.toSummary(updated);
  }

  async remove(id: string, auth: AuthContext): Promise<{ ok: true }> {
    await this.assertOwned(id, auth);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async cancel(id: string, auth: AuthContext): Promise<{ ok: true }> {
    const project = await this.assertOwned(id, auth);
    if (!project.temporalWorkflowId) {
      throw new BadRequestException('No workflow attached to this project');
    }
    const handle = this.temporal.client.workflow.getHandle(project.temporalWorkflowId);
    await handle.signal('cancel');
    return { ok: true };
  }

  // ── Queries ───────────────────────────────────────────────────────

  async list(
    auth: AuthContext,
    q: PaginationQuery,
  ): Promise<{ items: ProjectSummary[]; nextCursor: string | null }> {
    const items = await this.prisma.project.findMany({
      where: { orgId: auth.orgId, deletedAt: null },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = items.length > q.limit;
    const pageItems = hasMore ? items.slice(0, q.limit) : items;
    const last = pageItems[pageItems.length - 1];
    return {
      items: pageItems.map((p) => this.toSummary(p)),
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  async getDetail(id: string, auth: AuthContext): Promise<ProjectDetail> {
    const p = await this.prisma.project.findFirst({
      where: { id, orgId: auth.orgId, deletedAt: null },
      include: {
        scenes: {
          orderBy: { idx: 'asc' },
          include: {
            selectedImage: true,
            selectedVideo: true,
            selectedLipSync: true,
            locales: {
              include: { voiceAsset: true, lipSyncAsset: true, subtitleAsset: true },
            },
          },
        },
        renders: { include: { outputAsset: true } },
      },
    });
    if (!p) throw new NotFoundException();
    return this.toDetail(p);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private async assertOwned(id: string, auth: AuthContext) {
    const p = await this.prisma.project.findFirst({
      where: { id, orgId: auth.orgId, deletedAt: null },
    });
    if (!p) throw new NotFoundException();
    return p;
  }

  private toSummary(p: any): ProjectSummary {
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      format: p.format,
      durationTargetSec: p.durationTargetSec,
      sourceLocale: p.sourceLocale,
      targetLocales: p.targetLocales,
      thumbnailUrl: null,
      progress: this.statusToProgress(p.status),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private toDetail(p: any): ProjectDetail {
    return {
      ...this.toSummary(p),
      prompt: p.userPrompt,
      styleHint: p.styleHint,
      platformHint: p.platformHint,
      scriptJson: p.scriptJson,
      storyboardJson: p.storyboardJson,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      seoHashtags: p.seoHashtags,
      totalGpuSeconds: p.totalGpuSeconds,
      totalCostCredits: p.totalCostCredits,
      estimatedFinishAt: null,
      scenes: p.scenes.map((s: any) => this.sceneToView(s)),
      renders: p.renders.map((r: any) => this.renderToSummary(r)),
    };
  }

  private sceneToView(s: any) {
    return {
      id: s.id,
      idx: s.idx,
      durationSec: s.durationSec,
      narrativeGoal: s.narrativeGoal,
      visualDescription: s.visualDescription,
      mood: s.mood,
      location: s.location,
      cameraShotType: s.cameraShotType,
      cameraMovement: s.cameraMovement,
      cameraLens: s.cameraLens,
      lighting: s.lighting,
      imagePrompt: s.imagePrompt,
      videoPrompt: s.videoPrompt,
      musicPromptHint: s.musicPromptHint,
      sfxHints: s.sfxHints,
      transitionIn: s.transitionIn,
      transitionOut: s.transitionOut,
      status: s.status,
      selectedImage: s.selectedImage ? this.assetRef(s.selectedImage) : null,
      selectedVideo: s.selectedVideo ? this.assetRef(s.selectedVideo) : null,
      selectedLipSync: s.selectedLipSync ? this.assetRef(s.selectedLipSync) : null,
      locales: (s.locales ?? []).map((l: any) => ({
        locale: l.locale,
        voiceText: l.voiceText,
        dialogueText: l.dialogueText,
        subtitleText: l.subtitleText,
        voiceSpeakerType: l.voiceSpeakerType,
        voiceEmotion: l.voiceEmotion,
        voiceSpeed: l.voiceSpeed,
        voiceAsset: l.voiceAsset ? this.assetRef(l.voiceAsset) : null,
        lipSyncAsset: l.lipSyncAsset ? this.assetRef(l.lipSyncAsset) : null,
        subtitleAsset: l.subtitleAsset ? this.assetRef(l.subtitleAsset) : null,
      })),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private renderToSummary(r: any) {
    return {
      id: r.id,
      projectId: r.projectId,
      locale: r.locale,
      format: r.format,
      status: r.status,
      durationSec: r.durationSec,
      resolution: r.resolution,
      codec: r.codec,
      fps: r.fps,
      bitrateKbps: r.bitrateKbps,
      outputAsset: r.outputAsset ? this.assetRef(r.outputAsset) : null,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private assetRef(a: any) {
    return {
      id: a.id,
      kind: a.kind,
      version: a.version,
      mime: a.mime,
      width: a.width,
      height: a.height,
      durationMs: a.durationMs,
      url: null, // filled by AssetsService.signedUrl on demand
    };
  }

  private statusToProgress(status: string): number {
    switch (status) {
      case 'DRAFT':
        return 0;
      case 'PLANNING':
        return 0.1;
      case 'GENERATING':
        return 0.5;
      case 'RENDERING':
        return 0.9;
      case 'COMPLETED':
        return 1;
      default:
        return 0;
    }
  }
}
