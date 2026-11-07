"""
Safe tool surface for gpt-4o-mini Function Calling.

Security model
--------------
- Only named tools from TOOL_DEFINITIONS may run.
- Subprocess: allowlisted command *keys* only (no free-form shell).
- Python helpers: only scripts under project `tools/` with an allowlisted basename.
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
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Awaitable

from app.config import Settings, get_settings
from app.core.memory import AdaptiveMemory, get_adaptive_memory

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

_DANGEROUS_ARG_RE = re.compile(
    r"(rm\s+-rf|del\s+/[sf]|format\s+|shutdown|reboot|Invoke-Expression|"
    r"Start-Process|Remove-Item|reg\s+delete|curl\s+.+\|\s*sh|"
    r"powershell\s+-enc|cmd\s+/c\s+del)",
    re.IGNORECASE,
)

SUBPROCESS_TIMEOUT_S = 12.0
MAX_LOG_BYTES = 8_192
MAX_TOOL_RESULT_CHARS = 2_500


@dataclass
class ToolResult:
    ok: bool
    output: str
    meta: dict[str, Any] = field(default_factory=dict)


ToolHandler = Callable[["ToolRegistry", dict[str, Any]], Awaitable[ToolResult]]


def _truncate(text: str, limit: int = MAX_TOOL_RESULT_CHARS) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n…[truncated]"


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
                "(e.g. diagnostico_bluetooth.py)."
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
                "(flags only — never secret values)."
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
            "description": "Search adaptive memory (preferences + past interactions / notes).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "client_id": {"type": "string"},
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
            "description": "Store a short preference or note in adaptive client DNA (ChromaDB).",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "key": {
                        "type": "string",
                        "description": "Preference key (e.g. brevity, language, note).",
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
            return ToolResult(ok=False, output=f"Unknown tool: {name}")
        # Hard reject dangerous free-text in any string arg
        blob = json.dumps(arguments, ensure_ascii=False)
        if _DANGEROUS_ARG_RE.search(blob):
            return ToolResult(
                ok=False,
                output="Blocked: arguments match dangerous OS pattern",
                meta={"blocked": True},
            )
        try:
            return await handler(self, arguments or {})
        except Exception as exc:  # noqa: BLE001
            logger.exception("tool %s failed", name)
            return ToolResult(ok=False, output=f"{type(exc).__name__}: {exc}")

    async def _run_allowlisted_command(self, args: dict[str, Any]) -> ToolResult:
        command_key = (args.get("command_key") or "").strip()
        helper_name = (args.get("helper_name") or "").strip()
        helper_args = args.get("helper_args") or []

        if command_key:
            if command_key not in ALLOWLISTED_COMMANDS:
                return ToolResult(
                    ok=False,
                    output=f"command_key not allowlisted: {command_key}",
                    meta={"blocked": True},
                )
            cmd = list(ALLOWLISTED_COMMANDS[command_key])
            return await self._subprocess(cmd, label=command_key)

        if helper_name:
            base = Path(helper_name).name
            if base != helper_name or base not in ALLOWLISTED_HELPERS:
                return ToolResult(
                    ok=False,
                    output=f"helper not allowlisted: {helper_name}",
                    meta={"blocked": True},
                )
            if not isinstance(helper_args, list) or any(
                not isinstance(a, str) or _DANGEROUS_ARG_RE.search(a) or ";" in a or "|" in a
                for a in helper_args
            ):
                return ToolResult(
                    ok=False,
                    output="helper_args rejected",
                    meta={"blocked": True},
                )
            # Resolve under tools/
            matches = list((self._root / "tools").rglob(base))
            if not matches:
                return ToolResult(ok=False, output=f"helper not found: {base}")
            script = matches[0]
            safe = _safe_under_root(script, self._root)
            if safe is None or "tools" not in safe.parts:
                return ToolResult(ok=False, output="helper path escapes sandbox", meta={"blocked": True})
            cmd = [sys.executable, str(safe), *[str(a) for a in helper_args]]
            return await self._subprocess(cmd, label=f"helper:{base}")

        return ToolResult(
            ok=False,
            output="Provide command_key or helper_name",
            meta={"blocked": True},
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
        except Exception as exc:  # noqa: BLE001
            return ToolResult(ok=False, output=f"subprocess error: {exc}", meta={"label": label})

        combined = _truncate((out + ("\n" + err if err else "")).strip() or f"exit={code}")
        return ToolResult(
            ok=code == 0,
            output=combined,
            meta={"label": label, "exit_code": code},
        )

    async def _get_env_status(self, args: dict[str, Any]) -> ToolResult:
        _ = args
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
        }
        return ToolResult(ok=True, output=json.dumps(payload, ensure_ascii=False, indent=2))

    async def _list_project_dirs(self, args: dict[str, Any]) -> ToolResult:
        rel = (args.get("relative_path") or ".").strip() or "."
        if ".." in Path(rel).parts:
            return ToolResult(ok=False, output="relative_path must not contain ..", meta={"blocked": True})
        target = _safe_under_root(self._root / rel, self._root)
        if target is None or not target.exists():
            return ToolResult(ok=False, output=f"path not found: {rel}")
        if not target.is_dir():
            return ToolResult(ok=False, output=f"not a directory: {rel}")
        entries = []
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower())[:60]:
            kind = "dir" if child.is_dir() else "file"
            entries.append(f"{kind}\t{child.name}")
        return ToolResult(ok=True, output="\n".join(entries) or "(empty)")

    async def _read_project_logs(self, args: dict[str, Any]) -> ToolResult:
        rel = (args.get("relative_path") or "").strip()
        if not rel or ".." in Path(rel).parts:
            return ToolResult(ok=False, output="invalid relative_path", meta={"blocked": True})
        # Only logs under known folders
        first = Path(rel).parts[0].lower() if Path(rel).parts else ""
        if first not in {"logs", "backend", "data", "client", "tools"}:
            return ToolResult(
                ok=False,
                output="logs only allowed under logs/, backend/, data/, client/, tools/",
                meta={"blocked": True},
            )
        path = _safe_under_root(self._root / rel, self._root)
        if path is None or not path.is_file():
            return ToolResult(ok=False, output=f"log not found: {rel}")
        if path.suffix.lower() not in {".log", ".txt", ".json", ".md", ".out", ".err"}:
            return ToolResult(ok=False, output="file type not allowed for log read", meta={"blocked": True})
        data = path.read_bytes()
        tail = data[-MAX_LOG_BYTES:]
        text = tail.decode("utf-8", errors="replace")
        return ToolResult(ok=True, output=_truncate(text), meta={"bytes": len(tail)})

    async def _memory_read_notes(self, args: dict[str, Any]) -> ToolResult:
        query = (args.get("query") or "").strip()
        client_id = (args.get("client_id") or "default").strip() or "default"
        if not query:
            return ToolResult(ok=False, output="query required")
        memory = self._memory_or_none()
        if memory is None or not memory.available:
            return ToolResult(ok=False, output="adaptive memory unavailable")
        hits = memory.search_context(query, client_id=client_id)
        block = memory.format_context_block(hits) or "(no matching notes)"
        return ToolResult(ok=True, output=_truncate(block), meta={"hits": len(hits)})

    async def _memory_write_note(self, args: dict[str, Any]) -> ToolResult:
        text = (args.get("text") or "").strip()
        key = (args.get("key") or "note").strip() or "note"
        client_id = (args.get("client_id") or "default").strip() or "default"
        if not text:
            return ToolResult(ok=False, output="text required")
        if len(text) > 500:
            return ToolResult(ok=False, output="note too long (max 500 chars)")
        memory = self._memory_or_none()
        if memory is None or not memory.available:
            return ToolResult(ok=False, output="adaptive memory unavailable")
        memory.remember_preference(text, client_id=client_id, key=key[:64])
        return ToolResult(ok=True, output=f"Stored note key={key} for client={client_id}")
