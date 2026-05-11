from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    MUSIC_PORT: int = 7003
    # Available: facebook/musicgen-small (1.2GB), facebook/musicgen-medium (5.4GB), facebook/musicgen-large (13GB).
    # Default: small — easy on memory. Override via MUSIC_MODEL env var if you have RAM to spare.
    MUSIC_MODEL: str = "facebook/musicgen-small"
    # MPS for Apple Silicon, "cpu" as fallback, "cuda" on Linux+GPU
    MUSIC_DEVICE: str = "mps"
    # MusicGen samples ~50 tokens per second of audio. We cap at 10s for memory safety
    # — the render service loops audio to fill the full video duration anyway.
    # Peak inference memory scales with sequence length (KV cache + activations).
    MUSIC_MAX_DURATION_SEC: int = 10
    MUSIC_GUIDANCE_SCALE: float = 3.0
    # If true, model is unloaded after each generation (frees ~1-8 GB depending on size)
    # at the cost of a reload (~5-15s) on the next call. Defaults to true on 64 GB Macs
    # because ComfyUI + Ollama already eat most of the unified memory.
    MUSIC_UNLOAD_AFTER: bool = True

    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
