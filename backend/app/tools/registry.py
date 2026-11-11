"""Backend tool registry with clear invoke interfaces + parallel async calling."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from app.config import Settings, get_settings
from app.introspection import handlers as help_handlers
from app.tools import handlers, os_handlers, research_handlers
from app.tools.schemas import TOOL_SCHEMAS, ToolSchema, schema_by_name, schemas_for_prompt
from app.tools.validation import validate_tool_args

logger = logging.getLogger("aether.tools.registry")

ToolHandler = Callable[..., Awaitable[dict[str, Any]]]


@dataclass
class ToolContext:
    profile_id: str = "local"
    settings: Settings | None = None
    source: str = "live"


@dataclass
class ToolResult:
    name: str
    ok: bool
    result: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    elapsed_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "ok": self.ok,
            "result": self.result,
            "error": self.error,
            "elapsed_ms": self.elapsed_ms,
        }

    def context_line(self) -> str:
        if not self.ok:
            return f"Tool {self.name} failed: {self.error or 'unknown'}"
        # Compact HUD-friendly summary
        keys = [
            "sol",
            "lamports",
            "preference_summary",
            "status",
            "routine",
            "wallet",
            "address",
            "action",
            "speak",
            "pending_id",
            "detail",
            "version",
            "ttft_ms",
            "category",
            "action",
        ]
        bits = [f"{k}={self.result[k]}" for k in keys if k in self.result and self.result[k] is not None]
        if not bits:
            bits = [f"ok={self.ok}"]
        return f"Tool {self.name}: " + ", ".join(bits[:6])


class ToolRegistry:
    """Dynamic function-calling layer — register / list / invoke."""

    def __init__(self) -> None:
        self._handlers: dict[str, ToolHandler] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.register("solana_treasury_query", handlers.solana_treasury_query)
        self.register("onchain_lookup", handlers.onchain_lookup)
        self.register("run_test_routine", handlers.run_test_routine)
        self.register("memory_payload", handlers.memory_payload)
        # Hands-free OS agent tools (mock bridge on web/desktop).
        self.register("messaging_tool", os_handlers.messaging_tool)
        self.register("email_calendar_tool", os_handlers.email_calendar_tool)
        self.register("telephony_tool", os_handlers.telephony_tool)
        self.register("system_control_tool", os_handlers.system_control_tool)
        # Introspection / help (read-only — never pending_confirmation).
        self.register("system_help_tool", help_handlers.system_help_tool)
        # Gemini-level productivity: Deep Research + Canvas semantic edits.
        self.register("deep_research_tool", research_handlers.deep_research_tool)
        self.register("canvas_edit_tool", research_handlers.canvas_edit_tool)

    def register(self, name: str, handler: ToolHandler) -> None:
        self._handlers[name] = handler

    def has(self, name: str) -> bool:
        return name in self._handlers

    def list_schemas(self) -> list[ToolSchema]:
        return list(TOOL_SCHEMAS)

    def list_names(self) -> list[str]:
        return sorted(self._handlers.keys())

    def get_schema(self, name: str) -> ToolSchema | None:
        return schema_by_name(name)

    def prompt_catalog(self) -> list[dict[str, Any]]:
        return schemas_for_prompt()

    async def invoke(
        self,
        name: str,
        args: dict[str, Any] | None = None,
        *,
        ctx: ToolContext | None = None,
        validate: bool = True,
    ) -> ToolResult:
        started = time.perf_counter()
        handler = self._handlers.get(name)
        if handler is None:
            return ToolResult(
                name=name,
                ok=False,
                error=f"unknown tool: {name}",
                elapsed_ms=(time.perf_counter() - started) * 1000.0,
            )
        normalized = args or {}
        if validate:
            normalized, verr = validate_tool_args(name, normalized)
            if verr:
                return ToolResult(
                    name=name,
                    ok=False,
                    error=f"invalid args: {verr}",
                    elapsed_ms=(time.perf_counter() - started) * 1000.0,
                )
        context = ctx or ToolContext()
        settings = context.settings or get_settings()
        try:
            payload = await handler(
                normalized or {},
                settings=settings,
                profile_id=context.profile_id,
            )
            ok = bool(payload.get("ok", True))
            return ToolResult(
                name=name,
                ok=ok,
                result=payload if isinstance(payload, dict) else {"value": payload},
                error=None if ok else str((payload or {}).get("error") or "tool reported failure"),
                elapsed_ms=(time.perf_counter() - started) * 1000.0,
            )
        except Exception as exc:  # noqa: BLE001 — surface to Live as tool error
            logger.exception("tool invoke failed name=%s", name)
            return ToolResult(
                name=name,
                ok=False,
                error=str(exc)[:240],
                elapsed_ms=(time.perf_counter() - started) * 1000.0,
            )

    async def invoke_many(
        self,
        calls: Iterable[tuple[str, dict[str, Any] | None]],
        *,
        ctx: ToolContext | None = None,
        limit: int = 9,
    ) -> list[ToolResult]:
        """Async parallel invoke across the registry (capped to 9 tools)."""
        batch = list(calls)[: max(1, min(int(limit), 9))]
        if not batch:
            return []
        return list(
            await asyncio.gather(
                *[self.invoke(name, args, ctx=ctx) for name, args in batch]
            )
        )


@lru_cache
def get_tool_registry() -> ToolRegistry:
    return ToolRegistry()
