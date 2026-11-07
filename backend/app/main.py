"""FastAPI entrypoint for Aether Vision Phase 1 voice pipeline."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.middleware.errors import pipeline_error_handler, unhandled_error_handler
from app.routes import health, process_audio
from app.services.resilience import PipelineError

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())

app = FastAPI(
    title="Aether Vision Voice API",
    description=(
        "Phase 1 MVP — ultra-fast voice assistant pipeline for generic "
        "Bluetooth headphones. STT (Whisper) → agent → Consenso Alfa → TTS."
    ),
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(PipelineError, pipeline_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(health.router)
app.include_router(process_audio.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "aether-vision-voice",
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
        "process_audio": "POST /process-audio",
    }
