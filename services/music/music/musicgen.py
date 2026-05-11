"""MusicGen wrapper.

- Loads the model once at startup (lazy on first call).
- Generates WAV bytes for a given prompt + duration.
- Falls back to CPU if MPS is unavailable.
"""
from __future__ import annotations

import io
import logging
from threading import Lock

import numpy as np
import scipy.io.wavfile
import torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

from music.config import settings

log = logging.getLogger("music.musicgen")

# MusicGen samples ~50 codec tokens per second of audio
TOKENS_PER_SECOND = 50


class MusicGenEngine:
    def __init__(self) -> None:
        self.processor: AutoProcessor | None = None
        self.model: MusicgenForConditionalGeneration | None = None
        self.sample_rate: int = 32000
        self.device: str = "cpu"
        self._lock = Lock()

    # ── public ─────────────────────────────────────────────────────

    def warm_up(self) -> None:
        with self._lock:
            self._ensure_loaded()

    def synthesize_wav(self, prompt: str, duration_sec: float) -> bytes:
        duration_sec = max(2.0, min(float(settings.MUSIC_MAX_DURATION_SEC), duration_sec))
        max_new_tokens = int(duration_sec * TOKENS_PER_SECOND)

        with self._lock:
            self._ensure_loaded()
            assert self.processor is not None and self.model is not None

            log.info(
                "Generating music prompt=%r duration=%.1fs tokens=%d device=%s",
                prompt[:80], duration_sec, max_new_tokens, self.device,
            )

            inputs = self.processor(
                text=[prompt],
                padding=True,
                return_tensors="pt",
            ).to(self.device)

            try:
                with torch.no_grad():
                    audio_values = self.model.generate(
                        **inputs,
                        max_new_tokens=max_new_tokens,
                        do_sample=True,
                        guidance_scale=settings.MUSIC_GUIDANCE_SCALE,
                    )

                # audio_values shape: (batch=1, channels=1, samples)
                audio = audio_values[0, 0].cpu().to(torch.float32).numpy()
                audio = np.clip(audio, -1.0, 1.0)
                audio_int16 = (audio * 32767.0).astype(np.int16)

                buf = io.BytesIO()
                scipy.io.wavfile.write(buf, rate=self.sample_rate, data=audio_int16)
                return buf.getvalue()
            finally:
                if settings.MUSIC_UNLOAD_AFTER:
                    self._unload()

    def _unload(self) -> None:
        log.info("Unloading MusicGen model to free memory")
        self.model = None
        self.processor = None
        if self.device == "mps":
            torch.mps.empty_cache()
        elif self.device == "cuda":
            torch.cuda.empty_cache()

    # ── internals ──────────────────────────────────────────────────

    def _pick_device(self) -> str:
        requested = settings.MUSIC_DEVICE.lower()
        if requested == "mps" and torch.backends.mps.is_available():
            return "mps"
        if requested == "cuda" and torch.cuda.is_available():
            return "cuda"
        return "cpu"

    def _ensure_loaded(self) -> None:
        if self.model is not None:
            return
        device = self._pick_device()
        log.info("Loading %s on %s (this may take 10-60s)…", settings.MUSIC_MODEL, device)
        self.processor = AutoProcessor.from_pretrained(settings.MUSIC_MODEL)
        model = MusicgenForConditionalGeneration.from_pretrained(settings.MUSIC_MODEL)
        try:
            model = model.to(device)
            self.device = device
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to move model to %s (%s) — falling back to CPU", device, exc)
            model = model.to("cpu")
            self.device = "cpu"
        self.model = model
        self.sample_rate = int(model.config.audio_encoder.sampling_rate)
        log.info("Model ready (sample_rate=%d, device=%s)", self.sample_rate, self.device)


_engine: MusicGenEngine | None = None


def get_engine() -> MusicGenEngine:
    global _engine
    if _engine is None:
        _engine = MusicGenEngine()
    return _engine
