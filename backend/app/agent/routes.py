"""HTTP surface for Deep Research (HUD productivity)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agent.deep_research import run_deep_research
from app.canvas.store import get_canvas_store
from app.config import get_settings

router = APIRouter(prefix="/research", tags=["research"])


class ResearchBody(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    profile_id: str = "local"
    max_subquestions: int = Field(default=5, ge=2, le=8)
    min_trust: float = Field(default=0.5, ge=0.0, le=1.0)
    source_limit: int = Field(default=12, ge=3, le=24)
    open_in_canvas: bool = True
    canvas_doc_id: str | None = None


@router.post("/run")
async def research_run(body: ResearchBody) -> dict[str, Any]:
    settings = get_settings()
    result = await run_deep_research(
        body.topic,
        settings=settings,
        max_subquestions=body.max_subquestions,
        min_trust=body.min_trust,
        source_limit=body.source_limit,
    )
    payload = result.to_dict()
    payload["canvas"] = None
    if result.ok and body.open_in_canvas:
        store = get_canvas_store()
        doc = store.upsert_research_report(
            topic=result.topic,
            markdown=result.report_markdown,
            profile_id=body.profile_id,
            doc_id=body.canvas_doc_id,
        )
        payload["canvas"] = doc.to_dict()
    return payload


@router.get("/health")
async def research_health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "ok": True,
        "deep_research": True,
        "gemini_text": settings.has_api_key(),
        "pipeline": [
            "decompose",
            "parallel_web_search",
            "trusted_sources_filter",
            "markdown_report",
        ],
    }
