"""GET /api/history and GET /api/metrics — session audit read APIs."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.db.store import consolidated_metrics, list_recent_sessions

router = APIRouter(tags=["history"])


@router.get("/api/history")
@router.get("/history")
async def get_history(
    limit: int = Query(default=50, ge=1, le=200),
    client_id: str | None = Query(default=None),
) -> dict[str, Any]:
    """Recent SessionLogs (newest first)."""
    items = list_recent_sessions(limit=limit, client_id=client_id)
    return {"count": len(items), "items": items}


@router.get("/api/metrics")
@router.get("/metrics")
async def get_metrics() -> dict[str, Any]:
    """Consolidated latency + best-effort token usage metrics."""
    return consolidated_metrics()
