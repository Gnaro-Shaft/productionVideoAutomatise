from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Workspace root .env (services/planner/planner/config.py → ../../../.env)
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    # OpenAI-compatible LLM endpoint.
    #   Ollama:  http://localhost:11434/v1   model = "qwen2.5:14b-instruct-q5_K_M"
    #   MLX:     http://localhost:8080/v1    model = "mlx-community/Qwen2.5-14B-Instruct-4bit"
    #   vLLM:    http://localhost:8000/v1    model = "<deployed model>"
    LLM_BASE_URL: str = "http://localhost:11434/v1"
    LLM_MODEL: str = "qwen2.5:14b-instruct-q5_K_M"
    LLM_API_KEY: str = "not-needed"
    LLM_TIMEOUT_SEC: float = 300.0

    PLANNER_PORT: int = 7001

    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
