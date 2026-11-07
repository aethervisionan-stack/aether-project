"""
Gemini native Function Calling tools against local SQLite (aether_vision.db).

Safe, allowlisted handlers only — query session logs/metrics and store context notes.
Never expose secrets. Never run arbitrary SQL.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable

from app.models.schemas import ToolInvocation

logger = logging.getLogger("aether.gemini.tools")

MAX_TOOL_ROUNDS = 3
ALLOWED_TOOL_NAMES = frozenset(
    {
        "query_session_logs",
        "query_metrics",
        "store_context_note",
        "list_context_notes",
    }
)


@dataclass
class ToolHandlerResult:
    ok: bool
    payload: dict[str, Any]
    preview: str


def gemini_function_declarations() -> list[dict[str, Any]]:
    """JSON-serializable FunctionDeclaration payloads for google-genai."""
    return [
        {
            "name": "query_session_logs",
            "description": (
                "Consulta as sessões recentes no SQLite local (session_logs): "
                "transcrições, respostas e latências. Use quando o utilizador "
                "perguntar pelo histórico ou últimas interações."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Máximo de linhas (1–40).",
                    },
                    "client_id": {
                        "type": "string",
                        "description": "Filtrar por client_id (opcional).",
                    },
                },
            },
        },
        {
            "name": "query_metrics",
            "description": (
                "Lê métricas consolidadas do SQLite (médias de latência STT/agent/"
                "consenso/TTS, consenso e auditoria). Use para status de desempenho."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
        {
            "name": "store_context_note",
            "description": (
                "Guarda uma nota de contexto curta no SQLite (context_notes). "
                "Só use com pedido explícito para salvar/anotar/lembrar."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "Texto da nota (máx. 2000 chars).",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Etiqueta curta (ex.: preferência, rotina, tarefa).",
                    },
                },
                "required": ["content"],
            },
        },
        {
            "name": "list_context_notes",
            "description": (
                "Lista notas de contexto guardadas no SQLite. "
                "Use quando o utilizador pedir o que já foi anotado."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Máximo de notas (1–50).",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Filtrar por tag (opcional).",
                    },
                    "client_id": {
                        "type": "string",
                        "description": "Filtrar por client_id (opcional).",
                    },
                },
            },
        },
    ]


def build_genai_tool(types_module: Any) -> Any:
    """Build types.Tool with FunctionDeclaration list for GenerateContentConfig."""
    decls = []
    for raw in gemini_function_declarations():
        decls.append(
            types_module.FunctionDeclaration(
                name=raw["name"],
                description=raw["description"],
                parameters=raw.get("parameters"),
            )
        )
    return types_module.Tool(function_declarations=decls)


def _safe_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return {str(k): v for k, v in raw.items()}
    return {}


def _preview(payload: dict[str, Any], *, limit: int = 400) -> str:
    try:
        text = json.dumps(payload, ensure_ascii=False, default=str)
    except Exception:  # noqa: BLE001
        text = str(payload)
    return text[:limit]


def execute_gemini_tool(
    name: str,
    arguments: dict[str, Any] | None,
    *,
    client_id: str = "default",
    request_id: str | None = None,
    sqlite_url: str = "",
) -> ToolHandlerResult:
    """
    Dispatch an allowlisted tool. Unknown names → structured error (never raise).
    """
    started = time.perf_counter()
    args = _safe_args(arguments)
    tool = (name or "").strip()

    if tool not in ALLOWED_TOOL_NAMES:
        payload = {"ok": False, "error": "unknown_tool", "name": tool}
        return ToolHandlerResult(ok=False, payload=payload, preview=_preview(payload))

    try:
        if tool == "query_session_logs":
            from app.db.store import list_recent_sessions

            limit = int(args.get("limit") or 10)
            cid = str(args.get("client_id") or client_id or "default")
            items = list_recent_sessions(limit=limit, client_id=cid, sqlite_url=sqlite_url)
            # Slim rows for the model
            slim = [
                {
                    "id": it.get("id"),
                    "timestamp": it.get("timestamp"),
                    "transcription": (it.get("transcription") or "")[:180],
                    "agent_response": (it.get("agent_response") or "")[:220],
                    "latency_total_ms": (it.get("latency_ms") or {}).get("total"),
                    "consensus_score": it.get("consensus_score"),
                }
                for it in items
            ]
            payload = {"ok": True, "count": len(slim), "sessions": slim}
        elif tool == "query_metrics":
            from app.db.store import consolidated_metrics

            metrics = consolidated_metrics(sqlite_url=sqlite_url)
            payload = {"ok": True, "metrics": metrics}
        elif tool == "store_context_note":
            from app.db.store import store_context_note

            content = str(args.get("content") or "")
            tag = str(args.get("tag") or "geral")
            cid = str(args.get("client_id") or client_id or "default")
            # Block obvious secret patterns without logging values
            lowered = content.lower()
            if any(k in lowered for k in ("api_key", "apikey", "secret", "password", "token=")):
                payload = {
                    "ok": False,
                    "error": "refused_possible_secret",
                    "detail": "Não guardo segredos/chaves em notas.",
                }
            else:
                payload = store_context_note(
                    content=content,
                    client_id=cid,
                    tag=tag,
                    request_id=request_id,
                    sqlite_url=sqlite_url,
                )
        else:  # list_context_notes
            from app.db.store import list_context_notes

            limit = int(args.get("limit") or 20)
            tag = args.get("tag")
            cid = args.get("client_id") or client_id
            notes = list_context_notes(
                client_id=str(cid) if cid else None,
                tag=str(tag) if tag else None,
                limit=limit,
                sqlite_url=sqlite_url,
            )
            payload = {"ok": True, "count": len(notes), "notes": notes}
    except Exception as exc:  # noqa: BLE001
        logger.warning("gemini tool failed name=%s err=%s", tool, type(exc).__name__)
        payload = {
            "ok": False,
            "error": "tool_execution_failed",
            "name": tool,
            "detail": type(exc).__name__,
        }

    elapsed = int((time.perf_counter() - started) * 1000)
    payload.setdefault("duration_ms", elapsed)
    return ToolHandlerResult(
        ok=bool(payload.get("ok")),
        payload=payload,
        preview=_preview(payload),
    )


def invocation_from_handler(
    name: str,
    arguments: dict[str, Any],
    result: ToolHandlerResult,
) -> ToolInvocation:
    return ToolInvocation(
        name=name,
        arguments=arguments,
        approved=True,
        executed=result.ok,
        blocked_reason=None if result.ok else str(result.payload.get("error") or "failed"),
        result_preview=result.preview,
        duration_ms=int(result.payload.get("duration_ms") or 0),
    )


def extract_function_calls(response: Any) -> list[tuple[str, dict[str, Any], Any]]:
    """
    Collect (name, args, raw_function_call) from a generate_content response.
    Prefers response.function_calls when available.
    """
    out: list[tuple[str, dict[str, Any], Any]] = []
    fcs = getattr(response, "function_calls", None) or []
    for fc in fcs:
        name = str(getattr(fc, "name", "") or "")
        args = _safe_args(getattr(fc, "args", None) or {})
        if name:
            out.append((name, args, fc))
    if out:
        return out

    # Fallback: walk candidates/parts
    try:
        cands = getattr(response, "candidates", None) or []
        for cand in cands:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                fc = getattr(part, "function_call", None)
                if not fc:
                    continue
                name = str(getattr(fc, "name", "") or "")
                args = _safe_args(getattr(fc, "args", None) or {})
                if name:
                    out.append((name, args, fc))
    except Exception:  # noqa: BLE001
        pass
    return out


# Type alias for optional dependency injection in tests
ToolExecutor = Callable[..., ToolHandlerResult]
