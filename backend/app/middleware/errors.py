"""Centralized error → JSON mapping."""

from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.models.schemas import ErrorResponse, PipelineStage
from app.services.resilience import PipelineError

logger = logging.getLogger(__name__)


async def pipeline_error_handler(_: Request, exc: PipelineError) -> JSONResponse:
    stage: PipelineStage | None
    try:
        stage = PipelineStage(exc.stage)
    except ValueError:
        stage = None
    body = ErrorResponse(
        error=str(exc),
        detail=exc.detail,
        retryable=exc.retryable,
        stage=stage,
    )
    status = 503 if exc.retryable else 400
    logger.error("pipeline error stage=%s retryable=%s detail=%s", exc.stage, exc.retryable, exc.detail)
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"))


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from starlette.exceptions import HTTPException as StarletteHTTPException

    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error=str(exc.detail),
                detail=str(exc.detail),
                retryable=exc.status_code >= 500,
            ).model_dump(mode="json"),
        )
    logger.exception("unhandled error on %s: %s", request.url.path, exc)
    body = ErrorResponse(
        error="Internal server error",
        detail=str(exc),
        retryable=True,
    )
    return JSONResponse(status_code=500, content=body.model_dump(mode="json"))
