"""FastAPI entrypoint for Aether Vision Phase 1 voice pipeline."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.core.config import BACKEND_ENV_FILE, load_backend_dotenv
from app.db import init_db
from app.middleware.errors import pipeline_error_handler, unhandled_error_handler
from app.routers import history as history_router
from app.routes import audio, health, process_audio
from app.services.resilience import PipelineError

# Absolute-path dotenv BEFORE settings cache (CWD-independent).
load_backend_dotenv(override=False)

settings = get_settings()
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("aether.main")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db_path = init_db()
    logger.info("sqlite tables ready path=%s", db_path)
    yield


app = FastAPI(
    title="Aether Vision Voice API",
    description=(
        "Phase 1 MVP — ultra-fast voice assistant pipeline for generic "
        "Bluetooth headphones. Whisper → gpt-4o-mini + DNA memory → "
        "Consenso Alfa → OpenAI TTS."
    ),
    version=__version__,
    lifespan=lifespan,
)

cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(
    "CORS allow_origins=%s (Vite client: http://127.0.0.1:5173 + localhost:5173)",
    cors_origins,
)

app.add_exception_handler(PipelineError, pipeline_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(health.router)
app.include_router(process_audio.router)
app.include_router(audio.router)
app.include_router(history_router.router)

logger.info(
    "pipeline use_mock_audio=%s stt=%s tts=%s openai_key_valid=%s env_file=%s memory=%s",
    settings.use_mock_audio,
    settings.effective_stt_provider(),
    settings.effective_tts_provider(),
    settings.has_valid_openai_key(),
    BACKEND_ENV_FILE,
    settings.memory_enabled,
)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "aether-vision-voice",
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
        "process_audio": "POST /process-audio",
        "audio": "GET /audio/{filename}",
        "history": "GET /api/history",
        "metrics": "GET /api/metrics",
    }
