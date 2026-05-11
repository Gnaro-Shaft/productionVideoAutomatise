from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from voice.schemas import TtsRequest
from voice.tts import get_engine

router = APIRouter()


@router.post("/tts", response_class=Response)
async def tts(req: TtsRequest) -> Response:
    """Generate speech as WAV bytes (audio/wav)."""
    try:
        wav_bytes = get_engine().synthesize_wav(
            text=req.text,
            locale=req.locale,
            speed=req.speed,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"tts: {exc}") from exc

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": 'inline; filename="speech.wav"',
            "X-Voice-Locale": req.locale,
        },
    )
