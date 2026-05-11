from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException

from planner.llm import LLMClient, LLMError
from planner.prompts import (
    PLAN_SCRIPT_SYSTEM,
    PLAN_SCRIPT_USER_TEMPLATE,
    STORYBOARD_SYSTEM,
    STORYBOARD_USER_TEMPLATE,
    TRANSLATE_SYSTEM,
    TRANSLATE_USER_TEMPLATE,
)
from planner.schemas import (
    PlanScriptRequest,
    PlanScriptResponse,
    ScriptJson,
    SeoOutput,
    StoryboardRequest,
    StoryboardResponse,
    TranslateRequest,
    TranslateResponse,
)

router = APIRouter()
llm = LLMClient()


@router.post("/plan-script", response_model=PlanScriptResponse)
async def plan_script(req: PlanScriptRequest) -> PlanScriptResponse:
    user_msg = PLAN_SCRIPT_USER_TEMPLATE.format(
        user_prompt=req.userPrompt,
        duration_target_sec=req.durationTargetSec,
        source_locale=req.sourceLocale,
        format=req.format,
        style_hint=req.styleHint or "non spécifié",
        platform_hint=req.platformHint or "généraliste",
    )

    try:
        raw = await llm.chat_json(
            messages=[
                {"role": "system", "content": PLAN_SCRIPT_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    try:
        return PlanScriptResponse(
            scriptJson=ScriptJson(
                title=raw["title"],
                hook=raw["hook"],
                beats=raw["beats"],
                cta=raw["cta"],
                tone=raw["tone"],
                estimatedDurationSec=int(raw["estimatedDurationSec"]),
            ),
            seo=SeoOutput(
                title=raw["seoTitle"],
                description=raw["seoDescription"],
                hashtags=list(raw["seoHashtags"]),
            ),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"invalid LLM output: {exc}; raw={json.dumps(raw)[:500]}",
        ) from exc


def _fill_scene_defaults(scenes: list[dict[str, Any]], req: StoryboardRequest) -> list[dict[str, Any]]:
    """Small models (Mistral 7B, Llama 8B) often drop fields under JSON pressure.
    We fill missing required fields with sane fallbacks so the workflow can keep going.

    voiceText is the key recovery: we fall back to the script beat description.
    """
    beats = req.scriptJson.beats
    n = max(1, len(scenes))
    default_duration = max(1, req.durationTargetSec // n)

    cleaned: list[dict[str, Any]] = []
    for i, raw in enumerate(scenes):
        scene = dict(raw)
        scene.setdefault("idx", i)

        # Critical fallback: voiceText ← beat description
        if not scene.get("voiceText"):
            scene["voiceText"] = (
                beats[i].description if i < len(beats) else f"Scène {i + 1}"
            )

        # Visual / narrative
        visual = scene.get("visualDescription") or scene.get("narrativeGoal") or scene["voiceText"]
        scene.setdefault("narrativeGoal", visual[:140])
        scene.setdefault("visualDescription", visual)

        # Camera / lighting
        scene.setdefault("durationSec", default_duration)
        scene.setdefault("mood", req.styleHint or "cinematic")
        scene.setdefault("location", "")
        scene.setdefault("cameraShotType", "medium")
        scene.setdefault("cameraMovement", "static")
        scene.setdefault("cameraLens", "anamorphic 50mm")
        scene.setdefault("lighting", "natural")

        # Prompts (image must be EN — fallback uses visual description, may end up FR; acceptable)
        scene.setdefault("imagePrompt", visual)
        scene.setdefault("videoPrompt", "")
        scene.setdefault("musicPromptHint", "")
        scene.setdefault("sfxHints", [])

        cleaned.append(scene)
    return cleaned


@router.post("/storyboard", response_model=StoryboardResponse)
async def storyboard(req: StoryboardRequest) -> StoryboardResponse:
    user_msg = STORYBOARD_USER_TEMPLATE.format(
        script_json=json.dumps(req.scriptJson.model_dump(), ensure_ascii=False),
        format=req.format,
        duration_target_sec=req.durationTargetSec,
        source_locale=req.sourceLocale,
        style_hint=req.styleHint or "cinematic realistic",
    )

    try:
        raw = await llm.chat_json(
            messages=[
                {"role": "system", "content": STORYBOARD_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.5,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    scenes_raw = raw.get("scenes") if isinstance(raw, dict) else None
    if not isinstance(scenes_raw, list) or not scenes_raw:
        raise HTTPException(
            status_code=502,
            detail=f"invalid LLM output: missing or empty 'scenes'; raw={json.dumps(raw)[:500]}",
        )

    scenes_cleaned = _fill_scene_defaults(scenes_raw, req)

    try:
        return StoryboardResponse.model_validate({"scenes": scenes_cleaned})
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"invalid LLM output: {exc}; raw={json.dumps(raw)[:500]}",
        ) from exc


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    user_msg = TRANSLATE_USER_TEMPLATE.format(
        text=req.text,
        source_locale=req.sourceLocale,
        target_locale=req.targetLocale,
    )

    try:
        raw = await llm.chat_json(
            messages=[
                {"role": "system", "content": TRANSLATE_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"llm: {exc}") from exc

    try:
        return TranslateResponse(translated=str(raw["translated"]))
    except (KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"invalid LLM output: {exc}; raw={json.dumps(raw)[:500]}",
        ) from exc
