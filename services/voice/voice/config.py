from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
_VOICES_DIR = Path(__file__).resolve().parents[1] / "voices"


class Settings(BaseSettings):
    VOICE_PORT: int = 7002
    VOICES_DIR: str = str(_VOICES_DIR)

    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


# locale → Piper voice mapping. Add more as needed.
LOCALE_TO_VOICE: dict[str, str] = {
    "fr-FR": "fr_FR-tom-medium",
    "en-US": "en_US-lessac-medium",
    "es-ES": "es_ES-davefx-medium",
}

DEFAULT_LOCALE = "fr-FR"

# HuggingFace base for Piper voices
HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

VOICE_PATHS: dict[str, tuple[str, str]] = {
    # voice_name → (folder_path, sample_rate_hint)
    "fr_FR-tom-medium": ("fr/fr_FR/tom/medium", "22050"),
    "en_US-lessac-medium": ("en/en_US/lessac/medium", "22050"),
    "es_ES-davefx-medium": ("es/es_ES/davefx/medium", "22050"),
}
