import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from voice.routes import router
from voice.tts import get_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Block accepting requests until voices are downloaded + ready."""
    engine = get_engine()
    engine.warm_up()
    yield


app = FastAPI(
    title="PVA Voice Service",
    version="0.0.1",
    description="Text-to-speech via Piper TTS (multilingual, on-device)",
    lifespan=lifespan,
)
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "voice"}
