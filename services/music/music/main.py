import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from music.musicgen import get_engine
from music.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load MusicGen weights eagerly so the first /music call is fast."""
    get_engine().warm_up()
    yield


app = FastAPI(
    title="PVA Music Service",
    version="0.0.1",
    description="Text-to-music via MusicGen (on-device, MPS-accelerated on Apple Silicon)",
    lifespan=lifespan,
)
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "music"}
