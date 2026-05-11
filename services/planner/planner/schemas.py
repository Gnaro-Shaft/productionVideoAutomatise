"""Wire-format schemas — camelCase fields to match the TS orchestrator contract."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# ── Plan script ────────────────────────────────────────────────────

class PlanScriptRequest(BaseModel):
    userPrompt: str
    durationTargetSec: int
    sourceLocale: str
    format: str
    styleHint: Optional[str] = None
    platformHint: Optional[str] = None


class ScriptBeat(BaseModel):
    time: int
    description: str


class ScriptJson(BaseModel):
    title: str
    hook: str
    beats: list[ScriptBeat]
    cta: str
    tone: str
    estimatedDurationSec: int


class SeoOutput(BaseModel):
    title: str
    description: str
    hashtags: list[str]


class PlanScriptResponse(BaseModel):
    scriptJson: ScriptJson
    seo: SeoOutput


# ── Storyboard ─────────────────────────────────────────────────────

class StoryboardRequest(BaseModel):
    scriptJson: ScriptJson
    format: str
    durationTargetSec: int
    sourceLocale: str
    styleHint: Optional[str] = None


class SceneSpec(BaseModel):
    idx: int
    durationSec: int
    narrativeGoal: str
    visualDescription: str
    mood: str
    location: str
    cameraShotType: str
    cameraMovement: str
    cameraLens: str
    lighting: str
    imagePrompt: str
    videoPrompt: str
    musicPromptHint: str
    sfxHints: list[str]
    transitionIn: Optional[str] = None
    transitionOut: Optional[str] = None
    voiceText: str


class StoryboardResponse(BaseModel):
    scenes: list[SceneSpec]


# ── Translate ──────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str
    sourceLocale: str
    targetLocale: str


class TranslateResponse(BaseModel):
    translated: str
