"""OpenAI-compatible async LLM client.

Works with any OpenAI-compatible backend:
  - Ollama   (`/v1/chat/completions`)
  - MLX      (`mlx_lm.server`)
  - vLLM, TGI, llama.cpp server, LiteLLM proxy, ...

Switch backend by changing LLM_BASE_URL + LLM_MODEL in .env.
No code change needed.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from json_repair import repair_json
from openai import AsyncOpenAI, OpenAIError

from planner.config import settings

log = logging.getLogger("planner.llm")


class LLMError(Exception):
    pass


class LLMClient:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or settings.LLM_BASE_URL).rstrip("/")
        self.model = model or settings.LLM_MODEL
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key=api_key or settings.LLM_API_KEY,
            timeout=timeout or settings.LLM_TIMEOUT_SEC,
        )

    async def chat_json(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.5,
    ) -> Any:
        """Calls the LLM with JSON object response_format and returns the parsed object."""
        try:
            res = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,  # type: ignore[arg-type]
                response_format={"type": "json_object"},
                temperature=temperature,
            )
        except OpenAIError as exc:
            raise LLMError(f"LLM call failed: {exc}") from exc

        if not res.choices:
            raise LLMError(f"LLM returned no choices: {res}")

        content = res.choices[0].message.content or ""
        if not content:
            raise LLMError(f"empty content from LLM: {res}")

        # Primary path: strict JSON parsing.
        try:
            return json.loads(content)
        except json.JSONDecodeError as primary_exc:
            log.warning(
                "Direct json.loads failed (%s) — attempting repair", primary_exc
            )

        # Fallback: json-repair (handles trailing commas, unescaped quotes,
        # truncated JSON, etc.). Common with longer LLM outputs.
        try:
            repaired = repair_json(content, return_objects=True)
            if isinstance(repaired, (dict, list)):
                return repaired
            # repair_json sometimes returns a string we then parse normally
            return json.loads(repaired)  # type: ignore[arg-type]
        except Exception as repair_exc:  # noqa: BLE001
            raise LLMError(
                f"invalid JSON from model (even after repair): {repair_exc}; "
                f"raw: {content[:500]}"
            ) from repair_exc
