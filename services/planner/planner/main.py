from fastapi import FastAPI

from planner.routes import router

app = FastAPI(
    title="PVA Planner Service",
    version="0.0.1",
    description="LLM-driven script, storyboard, and translation generation (Ollama)",
)
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "planner"}
