from pydantic import BaseModel, Field


class MusicRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    durationSec: float = Field(20.0, ge=2.0, le=30.0)
