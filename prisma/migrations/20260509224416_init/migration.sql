-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PLANNING', 'GENERATING', 'RENDERING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Format" AS ENUM ('VERTICAL_9_16', 'HORIZONTAL_16_9', 'SQUARE_1_1');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('REFERENCE_IMAGE', 'IMAGE', 'VIDEO_CLIP', 'VOICE_OVER', 'DIALOGUE', 'MUSIC', 'SFX', 'LIPSYNC_VIDEO', 'SUBTITLE_VTT', 'PROJECT_MUSIC', 'MASTER_AUDIO_MIX', 'MASTER_VIDEO', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('PLAN_SCRIPT', 'GEN_STORYBOARD', 'GEN_IMAGE', 'GEN_VIDEO', 'GEN_VOICE', 'GEN_DIALOGUE', 'GEN_MUSIC', 'GEN_SFX', 'RUN_LIPSYNC', 'TRANSLATE', 'GEN_SUBTITLES', 'RENDER_SCENE', 'RENDER_FINAL', 'MUX_AUDIO');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('PENDING', 'RENDERING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "format" "Format" NOT NULL DEFAULT 'VERTICAL_9_16',
    "durationTargetSec" INTEGER NOT NULL DEFAULT 60,
    "sourceLocale" TEXT NOT NULL DEFAULT 'fr-FR',
    "targetLocales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleHint" TEXT,
    "platformHint" TEXT,
    "scriptJson" JSONB,
    "storyboardJson" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoHashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "temporalWorkflowId" TEXT,
    "temporalRunId" TEXT,
    "totalGpuSeconds" INTEGER NOT NULL DEFAULT 0,
    "totalCostCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "narrativeGoal" TEXT NOT NULL,
    "visualDescription" TEXT NOT NULL,
    "mood" TEXT,
    "location" TEXT,
    "cameraShotType" TEXT,
    "cameraMovement" TEXT,
    "cameraLens" TEXT,
    "lighting" TEXT,
    "imagePrompt" TEXT,
    "videoPrompt" TEXT,
    "musicPromptHint" TEXT,
    "sfxHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transitionIn" TEXT,
    "transitionOut" TEXT,
    "status" "SceneStatus" NOT NULL DEFAULT 'PENDING',
    "selectedImageAssetId" TEXT,
    "selectedVideoAssetId" TEXT,
    "selectedLipSyncAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionPrompt" TEXT NOT NULL,
    "referenceImageAssetId" TEXT,
    "loraRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_characters" (
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "scene_characters_pkey" PRIMARY KEY ("sceneId","characterId")
);

-- CreateTable
CREATE TABLE "style_presets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePrompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "seed" INTEGER,
    "loraRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "style_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_locales" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "voiceText" TEXT NOT NULL,
    "dialogueText" TEXT,
    "subtitleText" TEXT,
    "voiceSpeakerType" TEXT,
    "voiceEmotion" TEXT,
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceAssetId" TEXT,
    "lipSyncAssetId" TEXT,
    "subtitleAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "s3Bucket" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "generatedByJobId" TEXT,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "workflowRef" TEXT,
    "promptUsed" TEXT,
    "seed" INTEGER,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "temporalWorkflowId" TEXT,
    "temporalRunId" TEXT,
    "temporalActivityId" TEXT,
    "idempotencyKey" TEXT,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "workflowRef" TEXT,
    "gpuSeconds" INTEGER NOT NULL DEFAULT 0,
    "costCredits" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "format" "Format" NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'PENDING',
    "outputAssetId" TEXT,
    "durationSec" INTEGER,
    "codec" TEXT,
    "resolution" TEXT,
    "fps" INTEGER,
    "bitrateKbps" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "org_members_userId_idx" ON "org_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_orgId_userId_key" ON "org_members"("orgId", "userId");

-- CreateIndex
CREATE INDEX "projects_orgId_status_idx" ON "projects"("orgId", "status");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE INDEX "scenes_projectId_status_idx" ON "scenes"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_projectId_idx_key" ON "scenes"("projectId", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "characters_projectId_name_key" ON "characters"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "style_presets_projectId_name_key" ON "style_presets"("projectId", "name");

-- CreateIndex
CREATE INDEX "scene_locales_locale_idx" ON "scene_locales"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "scene_locales_sceneId_locale_key" ON "scene_locales"("sceneId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "assets_s3Key_key" ON "assets"("s3Key");

-- CreateIndex
CREATE INDEX "assets_projectId_kind_idx" ON "assets"("projectId", "kind");

-- CreateIndex
CREATE INDEX "assets_sceneId_kind_idx" ON "assets"("sceneId", "kind");

-- CreateIndex
CREATE INDEX "assets_checksum_idx" ON "assets"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "assets_projectId_sceneId_kind_version_key" ON "assets"("projectId", "sceneId", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_idempotencyKey_key" ON "jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "jobs_projectId_status_idx" ON "jobs"("projectId", "status");

-- CreateIndex
CREATE INDEX "jobs_sceneId_kind_idx" ON "jobs"("sceneId", "kind");

-- CreateIndex
CREATE INDEX "jobs_temporalWorkflowId_idx" ON "jobs"("temporalWorkflowId");

-- CreateIndex
CREATE UNIQUE INDEX "renders_outputAssetId_key" ON "renders"("outputAssetId");

-- CreateIndex
CREATE INDEX "renders_projectId_status_idx" ON "renders"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "renders_projectId_locale_format_key" ON "renders"("projectId", "locale", "format");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_idx" ON "audit_logs"("projectId");

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_selectedImageAssetId_fkey" FOREIGN KEY ("selectedImageAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_selectedVideoAssetId_fkey" FOREIGN KEY ("selectedVideoAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_selectedLipSyncAssetId_fkey" FOREIGN KEY ("selectedLipSyncAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_referenceImageAssetId_fkey" FOREIGN KEY ("referenceImageAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_characters" ADD CONSTRAINT "scene_characters_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_characters" ADD CONSTRAINT "scene_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_presets" ADD CONSTRAINT "style_presets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_locales" ADD CONSTRAINT "scene_locales_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_locales" ADD CONSTRAINT "scene_locales_voiceAssetId_fkey" FOREIGN KEY ("voiceAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_locales" ADD CONSTRAINT "scene_locales_lipSyncAssetId_fkey" FOREIGN KEY ("lipSyncAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_locales" ADD CONSTRAINT "scene_locales_subtitleAssetId_fkey" FOREIGN KEY ("subtitleAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_generatedByJobId_fkey" FOREIGN KEY ("generatedByJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renders" ADD CONSTRAINT "renders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renders" ADD CONSTRAINT "renders_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
