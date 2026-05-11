from pydantic import BaseModel, Field


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    locale: str = "fr-FR"
    speed: float = Field(1.0, ge=0.5, le=2.0)
    speakerType: str | None = None  # reserved for future voice variants
    emotion: str | None = None      # ditto
