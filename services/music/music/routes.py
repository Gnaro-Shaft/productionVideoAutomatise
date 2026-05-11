from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from music.musicgen import get_engine
from music.schemas import MusicRequest

router = APIRouter()


@router.post("/music", response_class=Response)
async def music(req: MusicRequest) -> Response:
    """Generate a music track as WAV bytes (audio/wav)."""
    try:
        wav_bytes = get_engine().synthesize_wav(
            prompt=req.prompt,
            duration_sec=req.durationSec,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"music: {exc}") from exc

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": 'inline; filename="music.wav"',
            "X-Music-Duration-Sec": str(req.durationSec),
        },
    )
