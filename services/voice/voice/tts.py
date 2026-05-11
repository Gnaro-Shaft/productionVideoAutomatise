"""Piper TTS engine wrapper.

- Lazily downloads voice .onnx + .onnx.json on first use (atomic via .tmp rename).
- Caches loaded PiperVoice instances in memory.
- Synthesizes WAV bytes for HTTP responses.
- All download / load operations are serialized via a single Lock to
  prevent races between warm-up and incoming /tts requests.
"""
from __future__ import annotations

import io
import logging
import wave
from pathlib import Path
from threading import Lock

import httpx
from piper.voice import PiperVoice, SynthesisConfig

from voice.config import (
    DEFAULT_LOCALE,
    HF_BASE,
    LOCALE_TO_VOICE,
    VOICE_PATHS,
    settings,
)

log = logging.getLogger("voice.tts")


class TTSEngine:
    def __init__(self, voices_dir: str | None = None) -> None:
        self.voices_dir = Path(voices_dir or settings.VOICES_DIR)
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, PiperVoice] = {}
        self._lock = Lock()

    # ── public ─────────────────────────────────────────────────────

    def warm_up(self) -> None:
        """Pre-download all configured voices so first /tts is fast."""
        for voice_name in LOCALE_TO_VOICE.values():
            try:
                self._ensure_voice(voice_name)
            except Exception as exc:  # noqa: BLE001
                log.warning(f"Could not warm up {voice_name}: {exc}")

    def synthesize_wav(
        self,
        text: str,
        locale: str = DEFAULT_LOCALE,
        speed: float = 1.0,
    ) -> bytes:
        voice_name = LOCALE_TO_VOICE.get(locale, LOCALE_TO_VOICE[DEFAULT_LOCALE])
        voice = self._load(voice_name)

        # length_scale > 1 = slower, < 1 = faster (inverse of "speed").
        syn_config = SynthesisConfig(length_scale=1.0 / max(speed, 0.1))

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            # Piper 1.2+: synthesize_wav handles setnchannels / setsampwidth / setframerate.
            voice.synthesize_wav(text, wav, syn_config=syn_config)
        return buf.getvalue()

    # ── internals ──────────────────────────────────────────────────

    def _load(self, voice_name: str) -> PiperVoice:
        if voice_name in self._cache:
            return self._cache[voice_name]
        with self._lock:
            if voice_name in self._cache:
                return self._cache[voice_name]
            onnx_path = self._ensure_voice_locked(voice_name)
            log.info(f"Loading Piper voice: {voice_name}")
            voice = PiperVoice.load(str(onnx_path))
            self._cache[voice_name] = voice
            return voice

    def _ensure_voice(self, voice_name: str) -> Path:
        """Public wrapper that acquires the lock."""
        with self._lock:
            return self._ensure_voice_locked(voice_name)

    def _ensure_voice_locked(self, voice_name: str) -> Path:
        """Must be called with self._lock already held."""
        onnx = self.voices_dir / f"{voice_name}.onnx"
        meta = self.voices_dir / f"{voice_name}.onnx.json"

        if onnx.exists() and onnx.stat().st_size > 1_000_000 and meta.exists():
            return onnx

        if voice_name not in VOICE_PATHS:
            raise ValueError(f"Unknown voice: {voice_name}")
        folder = VOICE_PATHS[voice_name][0]

        for filename in (f"{voice_name}.onnx", f"{voice_name}.onnx.json"):
            local = self.voices_dir / filename
            # Already fully downloaded? skip
            if local.exists() and local.stat().st_size > 1_000:
                continue

            url = f"{HF_BASE}/{folder}/{filename}?download=true"
            tmp = local.with_suffix(local.suffix + ".downloading")
            if tmp.exists():
                tmp.unlink()  # clear stale partial from a previous crash

            log.info(f"Downloading {filename} …")
            try:
                with httpx.Client(follow_redirects=True, timeout=120.0) as client:
                    with client.stream("GET", url) as resp:
                        resp.raise_for_status()
                        with open(tmp, "wb") as f:
                            for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                                f.write(chunk)
                tmp.rename(local)  # atomic on POSIX
                log.info(f"  → {local} ({local.stat().st_size:,} bytes)")
            except Exception:
                if tmp.exists():
                    tmp.unlink()
                raise

        return onnx


_engine: TTSEngine | None = None


def get_engine() -> TTSEngine:
    global _engine
    if _engine is None:
        _engine = TTSEngine()
    return _engine
