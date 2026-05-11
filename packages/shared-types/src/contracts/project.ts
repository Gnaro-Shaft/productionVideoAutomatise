import { z } from 'zod';
import { Format, Locale, PlatformHint, ProjectStatus } from '../enums';
import { Cuid, IsoDateTime } from './common';
import { RenderSummary } from './render';
import { SceneView } from './scene';

/** POST /v1/projects */
export const CreateProjectInput = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(10).max(2000),
  format: Format.default('VERTICAL_9_16'),
  durationTargetSec: z.number().int().min(10).max(300).default(60),
  sourceLocale: Locale.default('fr-FR'),
  targetLocales: z.array(Locale).default([]),
  styleHint: z.string().max(500).optional(),
  platformHint: PlatformHint.optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

/** PATCH /v1/projects/:id */
export const UpdateProjectInput = z.object({
  title: z.string().min(1).max(200).optional(),
  styleHint: z.string().max(500).nullable().optional(),
  platformHint: PlatformHint.nullable().optional(),
  targetLocales: z.array(Locale).optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

/** Item in GET /v1/projects */
export const ProjectSummary = z.object({
  id: Cuid,
  title: z.string(),
  status: ProjectStatus,
  format: Format,
  durationTargetSec: z.number().int(),
  sourceLocale: z.string(),
  targetLocales: z.array(z.string()),
  thumbnailUrl: z.string().url().nullable(),
  progress: z.number().min(0).max(1),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ProjectSummary = z.infer<typeof ProjectSummary>;

/** GET /v1/projects/:id */
export const ProjectDetail = ProjectSummary.extend({
  prompt: z.string(),
  styleHint: z.string().nullable(),
  platformHint: z.string().nullable(),
  scriptJson: z.unknown().nullable(),
  storyboardJson: z.unknown().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  seoHashtags: z.array(z.string()),
  scenes: z.array(SceneView),
  renders: z.array(RenderSummary),
  estimatedFinishAt: IsoDateTime.nullable(),
  totalGpuSeconds: z.number().int(),
  totalCostCredits: z.number().int(),
});
export type ProjectDetail = z.infer<typeof ProjectDetail>;
