import { ApplicationFailure } from '@temporalio/activity';
import { PlannerClient, type ScriptJson } from '../clients/planner';
import { db } from '../lib/db';

const planner = new PlannerClient();

export async function planScript(input: {
  projectId: string;
}): Promise<{ scriptJson: ScriptJson }> {
  const project = await db().project.findUnique({ where: { id: input.projectId } });
  if (!project) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Project ${input.projectId} not found`,
      nonRetryable: true,
    });
  }

  const result = await planner.planScript({
    userPrompt: project.userPrompt,
    durationTargetSec: project.durationTargetSec,
    sourceLocale: project.sourceLocale,
    format: project.format,
    styleHint: project.styleHint,
    platformHint: project.platformHint,
  });

  await db().project.update({
    where: { id: project.id },
    data: {
      scriptJson: result.scriptJson as never,
      seoTitle: result.seo.title,
      seoDescription: result.seo.description,
      seoHashtags: result.seo.hashtags,
    },
  });

  return { scriptJson: result.scriptJson };
}

export async function generateStoryboard(input: {
  projectId: string;
  scriptJson: unknown;
}): Promise<{ sceneIds: string[] }> {
  const project = await db().project.findUnique({ where: { id: input.projectId } });
  if (!project) {
    throw ApplicationFailure.create({
      type: 'NotFound',
      message: `Project ${input.projectId} not found`,
      nonRetryable: true,
    });
  }

  const result = await planner.storyboard({
    scriptJson: input.scriptJson as ScriptJson,
    format: project.format,
    durationTargetSec: project.durationTargetSec,
    sourceLocale: project.sourceLocale,
    styleHint: project.styleHint,
  });

  // Atomic creation: Scene + SceneLocale (source) per beat.
  const scenes = await db().$transaction(async (tx) => {
    const created: { id: string }[] = [];
    for (const scene of result.scenes) {
      const s = await tx.scene.create({
        data: {
          projectId: project.id,
          idx: scene.idx,
          durationSec: scene.durationSec,
          narrativeGoal: scene.narrativeGoal,
          visualDescription: scene.visualDescription,
          mood: scene.mood,
          location: scene.location,
          cameraShotType: scene.cameraShotType,
          cameraMovement: scene.cameraMovement,
          cameraLens: scene.cameraLens,
          lighting: scene.lighting,
          imagePrompt: scene.imagePrompt,
          videoPrompt: scene.videoPrompt,
          musicPromptHint: scene.musicPromptHint,
          sfxHints: scene.sfxHints,
          transitionIn: scene.transitionIn ?? null,
          transitionOut: scene.transitionOut ?? null,
        },
      });

      await tx.sceneLocale.create({
        data: {
          sceneId: s.id,
          locale: project.sourceLocale,
          voiceText: scene.voiceText,
        },
      });

      created.push({ id: s.id });
    }
    return created;
  });

  return { sceneIds: scenes.map((s) => s.id) };
}

export async function translate(input: {
  text: string;
  sourceLocale: string;
  targetLocale: string;
}): Promise<{ translated: string }> {
  return planner.translate(input);
}
