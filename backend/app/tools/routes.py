"""HTTP surface for tool catalog + ad-hoc invoke (HUD / MemoryInspector companions)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings
from app.tools.registry import ToolContext, get_tool_registry

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolInvokeBody(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    profile_id: str = "local"


@router.get("/catalog")
async def tool_catalog() -> dict[str, Any]:
    registry = get_tool_registry()
    return {
        "tools": registry.prompt_catalog(),
        "names": registry.list_names(),
    }


@router.post("/invoke")
async def tool_invoke(body: ToolInvokeBody) -> dict[str, Any]:
    registry = get_tool_registry()
    settings = get_settings()
    result = await registry.invoke(
        body.name,
        body.arguments,
        ctx=ToolContext(profile_id=body.profile_id, settings=settings, source="http"),
    )
    return result.to_dict()
