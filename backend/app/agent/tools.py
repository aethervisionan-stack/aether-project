"""
Safe tool surface for gpt-4o-mini Function Calling.

Security model
--------------
- Only named tools from TOOL_DEFINITIONS may run.
- Subprocess: allowlisted command *keys* only (no free-form shell).
- Python helpers: only scripts under project `tools/` with an allowlisted basename.
- Browser: https URLs only, host allowlist.
- Paths for logs/notes stay inside the project root (or memory API).
- Secrets (API keys) are never returned — only configured/missing flags.
- Consenso Alfa must approve each tool call *before* execute() (enforced in agent_service).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import webbrowser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

from app.config import Settings, get_settings
from app.core.memory import (
    SEMANTIC_TAGS,
    AdaptiveMemory,
    get_adaptive_memory,
    normalize_semantic_tag,
)

logger = logging.getLogger("aether.tools")

PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Named allowlist — never accept arbitrary argv from the model.
ALLOWLISTED_COMMANDS: dict[str, list[str]] = {
    "python_version": [sys.executable, "--version"],
    "git_status": ["git", "status", "--short"],
    "git_branch": ["git", "branch", "--show-current"],
    "list_backend": [
        sys.executable,
        "-c",
        "import os; print('\\n'.join(sorted(os.listdir('backend'))[:40]))",
    ],
}

ALLOWLISTED_HELPERS: frozenset[str] = frozenset(
    {
        "diagnostico_bluetooth.py",
    }
)

# Browser open — https only, explicit hosts (Bluetooth voice demos).
ALLOWLISTED_BROWSER_HOSTS: frozenset[str] = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "docs.aethervision.app",
        "github.com",
        "www.github.com",
        "openai.com",
        "platform.openai.com",
        "cursor.com",
        "www.cursor.com",
        "google.com",
        "www.google.com",
    }
)

_DANGEROUS_ARG_RE = re.compile(
    r"(rm\s+-rf|del\s+/[sf]|format\s+|shutdown|reboot|Invoke-Expression|"
    r"Start-Process|Remove-Item|reg\s+delete|curl\s+.+\|\s*sh|"
    r"powershell\s+-enc|cmd\s+/c\s+del)",
    re.IGNORECASE,
)

SUBPROCESS_TIMEOUT_S = 12.0
MAX_LOG_BYTES = 8_192
MAX_TOOL_RESULT_CHARS = 2_500
MAX_PROCESS_ROWS = 25


@dataclass
class ToolResult:
    ok: bool
    output: str
    meta: dict[str, Any] = field(default_factory=dict)

    def as_json_payload(self) -> dict[str, Any]:
        return {"ok": self.ok, "output": self.output, "meta": self.meta}


ToolHandler = Callable[["ToolRegistry", dict[str, Any]], Awaitable[ToolResult]]


def _truncate(text: str, limit: int = MAX_TOOL_RESULT_CHARS) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n…[truncated]"


def _structured_error(
    *,
    code: str,
    message: str,
    detail: str | None = None,
    blocked: bool = False,
) -> ToolResult:
    payload = {
        "error": True,
        "code": code,
        "message": message,
        "detail": detail or message,
    }
    return ToolResult(
        ok=False,
        output=json.dumps(payload, ensure_ascii=False),
        meta={"blocked": blocked, "error_code": code, **payload},
    )


def _safe_under_root(path: Path, root: Path = PROJECT_ROOT) -> Path | None:
    try:
        resolved = path.resolve()
        root_resolved = root.resolve()
        if root_resolved not in resolved.parents and resolved != root_resolved:
            return None
        return resolved
    except OSError:
        return None


# --- OpenAI function schemas -------------------------------------------------

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "run_allowlisted_command",
            "description": (
                "Run a pre-approved local command or Python helper. "
                "Use command_key from the allowlist (python_version, git_status, "
                "git_branch, list_backend) OR helper_name under tools/ "
                "(e.g. diagnostico_bluetooth.py). Errors return structured JSON."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command_key": {
                        "type": "string",
                        "description": "Allowlisted command key (preferred).",
                    },
                    "helper_name": {
                        "type": "string",
                        "description": "Allowlisted script basename under tools/.",
                    },
                    "helper_args": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional safe args for the helper (no shell metacharacters).",
                    },
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_env_status",
            "description": (
                "Report runtime/env status for the Aether Vision backend "
                "(flags only — never secret values). Errors as structured JSON."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_metrics",
            "description": "Read CPU percent and RAM usage via psutil (safe Windows automation).",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_active_processes",
            "description": (
                "List top active processes by memory (name, pid, rss_mb). "
                "Optional name_filter substring."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name_filter": {
                        "type": "string",
                        "description": "Optional case-insensitive process name filter.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max rows (1–25, default 15).",
                    },
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_browser_url",
            "description": (
                "Open the default browser to an allowlisted https URL "
                "(localhost, github.com, google.com, cursor.com, openai.com, …)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Full https URL to open.",
                    },
                },
                "required": ["url"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_project_dirs",
            "description": "List top-level project directories and key subfolders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Optional path relative to project root (default '.').",
                    },
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_project_logs",
            "description": (
                "Read the tail of a local project log file under logs/, backend/, or data/."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Log path relative to project root.",
                    },
                },
                "required": ["relative_path"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "memory_read_notes",
            "description": (
                "Search adaptive memory with semantic tags: rotina, preferência, tarefa."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "client_id": {"type": "string"},
                    "tag": {
                        "type": "string",
                        "description": f"Optional filter: {', '.join(sorted(SEMANTIC_TAGS))}.",
                    },
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "memory_write_note",
            "description": (
                "Store a short note/preference/task in adaptive DNA with a semantic tag "
                "(rotina | preferência | tarefa)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "tag": {
                        "type": "string",
                        "description": "Semantic tag: rotina, preferência, or tarefa.",
                    },
                    "key": {
                        "type": "string",
                        "description": "Optional preference key (e.g. brevity, language).",
                    },
                    "client_id": {"type": "string"},
                },
                "required": ["text"],
                "additionalProperties": False,
            },
        },
    },
]


def get_openai_tool_schemas() -> list[dict[str, Any]]:
    return TOOL_DEFINITIONS


def known_tool_names() -> frozenset[str]:
    return frozenset(t["function"]["name"] for t in TOOL_DEFINITIONS)


def is_allowlisted_browser_url(url: str) -> tuple[bool, str]:
    raw = (url or "").strip()
    if not raw:
        return False, "empty_url"
    try:
        parsed = urlparse(raw)
    except Exception:  # noqa: BLE001
        return False, "url_parse_error"
    if parsed.scheme.lower() != "https":
        return False, "https_only"
    host = (parsed.hostname or "").lower()
    if not host:
        return False, "missing_host"
    if host not in ALLOWLISTED_BROWSER_HOSTS:
        return False, f"host_not_allowlisted:{host}"
    return True, "ok"


class ToolRegistry:
    """Dispatch allowlisted tools with path/command sandboxing."""

    def __init__(
        self,
        settings: Settings | None = None,
        memory: AdaptiveMemory | None = None,
        project_root: Path | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._memory = memory
        self._root = (project_root or PROJECT_ROOT).resolve()
        self._handlers: dict[str, ToolHandler] = {
            "run_allowlisted_command": ToolRegistry._run_allowlisted_command,
            "get_env_status": ToolRegistry._get_env_status,
            "get_system_metrics": ToolRegistry._get_system_metrics,
            "list_active_processes": ToolRegistry._list_active_processes,
            "open_browser_url": ToolRegistry._open_browser_url,
            "list_project_dirs": ToolRegistry._list_project_dirs,
            "read_project_logs": ToolRegistry._read_project_logs,
            "memory_read_notes": ToolRegistry._memory_read_notes,
            "memory_write_note": ToolRegistry._memory_write_note,
        }

    def _memory_or_none(self) -> AdaptiveMemory | None:
        if self._memory is not None:
            return self._memory
        if not self._settings.memory_enabled:
            return None
        try:
            return get_adaptive_memory()
        except Exception as exc:  # noqa: BLE001
            logger.warning("tools.memory unavailable: %s", exc)
            return None

    async def execute(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        handler = self._handlers.get(name)
        if handler is None:
            return _structured_error(
                code="unknown_tool",
                message=f"Unknown tool: {name}",
                blocked=True,
            )
        blob = json.dumps(arguments, ensure_ascii=False)
        if _DANGEROUS_ARG_RE.search(blob):
            return _structured_error(
                code="dangerous_pattern",
                message="Blocked: arguments match dangerous OS pattern",
                blocked=True,
            )
        try:
            return await handler(self, arguments or {})
        except PermissionError as exc:
            logger.warning("tool %s permission denied: %s", name, exc)
            return _structured_error(
                code="permission_denied",
                message="Permission denied",
                detail=str(exc),
            )
        except SyntaxError as exc:
            logger.warning("tool %s syntax error: %s", name, exc)
            return _structured_error(
                code="syntax_error",
                message="Syntax error in tool arguments or helper",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("tool %s failed", name)
            return _structured_error(
                code="tool_exception",
                message=type(exc).__name__,
                detail=str(exc),
            )

    async def _run_allowlisted_command(self, args: dict[str, Any]) -> ToolResult:
        try:
            command_key = (args.get("command_key") or "").strip()
            helper_name = (args.get("helper_name") or "").strip()
            helper_args = args.get("helper_args") or []
        except Exception as exc:  # noqa: BLE001
            return _structured_error(
                code="syntax_error",
                message="Invalid arguments for run_allowlisted_command",
                detail=str(exc),
            )

        if command_key:
            if command_key not in ALLOWLISTED_COMMANDS:
                return _structured_error(
                    code="command_not_allowlisted",
                    message=f"command_key not allowlisted: {command_key}",
                    blocked=True,
                )
            cmd = list(ALLOWLISTED_COMMANDS[command_key])
            return await self._subprocess(cmd, label=command_key)

        if helper_name:
            base = Path(helper_name).name
            if base != helper_name or base not in ALLOWLISTED_HELPERS:
                return _structured_error(
                    code="helper_not_allowlisted",
                    message=f"helper not allowlisted: {helper_name}",
                    blocked=True,
                )
            if not isinstance(helper_args, list) or any(
                not isinstance(a, str) or _DANGEROUS_ARG_RE.search(a) or ";" in a or "|" in a
                for a in helper_args
            ):
                return _structured_error(
                    code="helper_args_rejected",
                    message="helper_args rejected",
                    blocked=True,
                )
            matches = list((self._root / "tools").rglob(base))
            if not matches:
                return _structured_error(
                    code="helper_not_found",
                    message=f"helper not found: {base}",
                )
            script = matches[0]
            safe = _safe_under_root(script, self._root)
            if safe is None or "tools" not in safe.parts:
                return _structured_error(
                    code="path_escape",
                    message="helper path escapes sandbox",
                    blocked=True,
                )
            cmd = [sys.executable, str(safe), *[str(a) for a in helper_args]]
            return await self._subprocess(cmd, label=f"helper:{base}")

        return _structured_error(
            code="missing_command_or_helper",
            message="Provide command_key or helper_name",
            blocked=True,
        )

    async def _subprocess(self, cmd: list[str], *, label: str) -> ToolResult:
        logger.info("tool.subprocess label=%s cmd=%s", label, cmd)

        def _run() -> tuple[int, str, str]:
            import subprocess

            proc = subprocess.run(
                cmd,
                cwd=str(self._root),
                capture_output=True,
                text=True,
                timeout=SUBPROCESS_TIMEOUT_S,
                shell=False,
                env={**os.environ, "PYTHONUTF8": "1"},
            )
            return proc.returncode, proc.stdout or "", proc.stderr or ""

        try:
            code, out, err = await asyncio.to_thread(_run)
        except PermissionError as exc:
            return _structured_error(
                code="permission_denied",
                message="Subprocess permission denied",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            return _structured_error(
                code="subprocess_error",
                message="subprocess error",
                detail=f"{type(exc).__name__}: {exc}",
            )

        combined = _truncate((out + ("\n" + err if err else "")).strip() or f"exit={code}")
        if code != 0:
            return ToolResult(
                ok=False,
                output=json.dumps(
                    {
                        "error": True,
                        "code": "non_zero_exit",
                        "message": combined,
                        "exit_code": code,
                        "label": label,
                    },
                    ensure_ascii=False,
                ),
                meta={"label": label, "exit_code": code, "error_code": "non_zero_exit"},
            )
        return ToolResult(
            ok=True,
            output=combined,
            meta={"label": label, "exit_code": code},
        )

    async def _get_env_status(self, args: dict[str, Any]) -> ToolResult:
        _ = args
        try:
            s = self._settings
            payload = {
                "python": sys.version.split()[0],
                "project_root": str(self._root),
                "use_mock_audio": s.use_mock_audio,
                "pipeline_mode": s.pipeline_mode,
                "stt_provider": s.effective_stt_provider(),
                "tts_provider": s.effective_tts_provider(),
                "openai_api_key_configured": bool(s.openai_api_key.strip()),
                "elevenlabs_api_key_configured": bool(s.elevenlabs_api_key.strip()),
                "consenso_enabled": s.consenso_enabled,
                "memory_enabled": s.memory_enabled,
                "chroma_persist_dir": s.chroma_persist_dir,
                "host": s.host,
                "port": s.port,
                "psutil_available": _psutil_available(),
            }
            return ToolResult(ok=True, output=json.dumps(payload, ensure_ascii=False, indent=2))
        except PermissionError as exc:
            return _structured_error(
                code="permission_denied",
                message="Cannot read env status",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            return _structured_error(
                code="env_status_error",
                message="Failed to build env status",
                detail=f"{type(exc).__name__}: {exc}",
            )

    async def _get_system_metrics(self, args: dict[str, Any]) -> ToolResult:
        _ = args
        try:
            import psutil
        except ImportError as exc:
            return _structured_error(
                code="psutil_missing",
                message="psutil is not installed",
                detail=str(exc),
            )

        def _sample() -> dict[str, Any]:
            cpu = psutil.cpu_percent(interval=0.15)
            mem = psutil.virtual_memory()
            return {
                "cpu_percent": round(float(cpu), 1),
                "ram_percent": round(float(mem.percent), 1),
                "ram_used_gb": round(mem.used / (1024**3), 2),
                "ram_total_gb": round(mem.total / (1024**3), 2),
            }

        try:
            metrics = await asyncio.to_thread(_sample)
            return ToolResult(
                ok=True,
                output=json.dumps(metrics, ensure_ascii=False),
                meta=metrics,
            )
        except PermissionError as exc:
            return _structured_error(
                code="permission_denied",
                message="Cannot read system metrics",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            return _structured_error(
                code="metrics_error",
                message="Failed to sample CPU/RAM",
                detail=f"{type(exc).__name__}: {exc}",
            )

    async def _list_active_processes(self, args: dict[str, Any]) -> ToolResult:
        name_filter = str(args.get("name_filter") or "").strip().lower()
        try:
            limit = int(args.get("limit") or 15)
        except (TypeError, ValueError):
            return _structured_error(
                code="syntax_error",
                message="limit must be an integer",
            )
        limit = max(1, min(MAX_PROCESS_ROWS, limit))

        try:
            import psutil
        except ImportError as exc:
            return _structured_error(
                code="psutil_missing",
                message="psutil is not installed",
                detail=str(exc),
            )

        def _collect() -> list[dict[str, Any]]:
            rows: list[dict[str, Any]] = []
            for proc in psutil.process_iter(["pid", "name", "memory_info"]):
                try:
                    info = proc.info
                    name = str(info.get("name") or "")
                    if name_filter and name_filter not in name.lower():
                        continue
                    mem = info.get("memory_info")
                    rss = getattr(mem, "rss", 0) or 0
                    rows.append(
                        {
                            "pid": info.get("pid"),
                            "name": name,
                            "rss_mb": round(rss / (1024**2), 1),
                        }
                    )
                except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError):
                    continue
            rows.sort(key=lambda r: float(r.get("rss_mb") or 0), reverse=True)
            return rows[:limit]

        try:
            rows = await asyncio.to_thread(_collect)
            return ToolResult(
                ok=True,
                output=json.dumps({"processes": rows, "count": len(rows)}, ensure_ascii=False),
                meta={"count": len(rows)},
            )
        except PermissionError as exc:
            return _structured_error(
                code="permission_denied",
                message="Cannot list processes",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            return _structured_error(
                code="process_list_error",
                message="Failed to list processes",
                detail=f"{type(exc).__name__}: {exc}",
            )

    async def _open_browser_url(self, args: dict[str, Any]) -> ToolResult:
        url = str(args.get("url") or "").strip()
        ok, reason = is_allowlisted_browser_url(url)
        if not ok:
            return _structured_error(
                code="url_not_allowlisted",
                message=f"URL rejected: {reason}",
                detail=url[:200],
                blocked=True,
            )

        def _open() -> bool:
            return bool(webbrowser.open(url, new=2))

        try:
            opened = await asyncio.to_thread(_open)
            return ToolResult(
                ok=True,
                output=json.dumps(
                    {"opened": opened, "url": url},
                    ensure_ascii=False,
                ),
                meta={"url": url, "opened": opened},
            )
        except PermissionError as exc:
            return _structured_error(
                code="permission_denied",
                message="Cannot open browser",
                detail=str(exc),
            )
        except Exception as exc:  # noqa: BLE001
            return _structured_error(
                code="browser_open_error",
                message="Failed to open browser",
                detail=f"{type(exc).__name__}: {exc}",
            )

    async def _list_project_dirs(self, args: dict[str, Any]) -> ToolResult:
        rel = (args.get("relative_path") or ".").strip() or "."
        if ".." in Path(rel).parts:
            return _structured_error(
                code="path_escape",
                message="relative_path must not contain ..",
                blocked=True,
            )
        target = _safe_under_root(self._root / rel, self._root)
        if target is None or not target.exists():
            return _structured_error(code="path_not_found", message=f"path not found: {rel}")
        if not target.is_dir():
            return _structured_error(code="not_a_directory", message=f"not a directory: {rel}")
        entries = []
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower())[:60]:
            kind = "dir" if child.is_dir() else "file"
            entries.append(f"{kind}\t{child.name}")
        return ToolResult(ok=True, output="\n".join(entries) or "(empty)")

    async def _read_project_logs(self, args: dict[str, Any]) -> ToolResult:
        rel = (args.get("relative_path") or "").strip()
        if not rel or ".." in Path(rel).parts:
            return _structured_error(
                code="invalid_path",
                message="invalid relative_path",
                blocked=True,
            )
        first = Path(rel).parts[0].lower() if Path(rel).parts else ""
        if first not in {"logs", "backend", "data", "client", "tools"}:
            return _structured_error(
                code="path_not_allowed",
                message="logs only allowed under logs/, backend/, data/, client/, tools/",
                blocked=True,
            )
        path = _safe_under_root(self._root / rel, self._root)
        if path is None or not path.is_file():
            return _structured_error(code="log_not_found", message=f"log not found: {rel}")
        if path.suffix.lower() not in {".log", ".txt", ".json", ".md", ".out", ".err"}:
            return _structured_error(
                code="file_type_blocked",
                message="file type not allowed for log read",
                blocked=True,
            )
        try:
            data = path.read_bytes()
        except PermissionError as exc:
            return _structured_error(
                code="permission_denied",
                message="Cannot read log file",
                detail=str(exc),
            )
        tail = data[-MAX_LOG_BYTES:]
        text = tail.decode("utf-8", errors="replace")
        return ToolResult(ok=True, output=_truncate(text), meta={"bytes": len(tail)})

    async def _memory_read_notes(self, args: dict[str, Any]) -> ToolResult:
        query = (args.get("query") or "").strip()
        client_id = (args.get("client_id") or "default").strip() or "default"
        tag_raw = args.get("tag")
        tag = normalize_semantic_tag(str(tag_raw)) if tag_raw else None
        if not query:
            return _structured_error(code="missing_query", message="query required")
        memory = self._memory_or_none()
        if memory is None or not memory.available:
            return _structured_error(
                code="memory_unavailable",
                message="adaptive memory unavailable",
            )
        hits = memory.search_context(query, client_id=client_id, tag=tag)
        block = memory.format_context_block(hits) or "(no matching notes)"
        return ToolResult(
            ok=True,
            output=_truncate(block),
            meta={"hits": len(hits), "tag": tag},
        )

    async def _memory_write_note(self, args: dict[str, Any]) -> ToolResult:
        text = (args.get("text") or "").strip()
        key = (args.get("key") or "note").strip() or "note"
        client_id = (args.get("client_id") or "default").strip() or "default"
        tag = normalize_semantic_tag(str(args.get("tag") or "preferência"))
        if not text:
            return _structured_error(code="missing_text", message="text required")
        if len(text) > 500:
            return _structured_error(code="note_too_long", message="note too long (max 500 chars)")
        memory = self._memory_or_none()
        if memory is None or not memory.available:
            return _structured_error(
                code="memory_unavailable",
                message="adaptive memory unavailable",
            )
        memory.remember_preference(
            text,
            client_id=client_id,
            key=key[:64],
            tag=tag,
        )
        return ToolResult(
            ok=True,
            output=json.dumps(
                {
                    "stored": True,
                    "tag": tag,
                    "key": key,
                    "client_id": client_id,
                },
                ensure_ascii=False,
            ),
            meta={"tag": tag, "key": key},
        )


def _psutil_available() -> bool:
    try:
        import psutil  # noqa: F401

        return True
    except ImportError:
        return False
