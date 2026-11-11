"""
Isolated safe env for tiny Python snippets.

Constraints:
  - temp cwd only (deleted after run)
  - timeout hard-kill
  - no inherited host secrets in argv
  - network discouraged (no helper networking; OS may still allow — keep snippets data-only)
  - never arbitrary unrestricted host filesystem access
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import tempfile
import textwrap
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger("aether.sandbox")

DEFAULT_TIMEOUT_S = 2.5
MAX_SOURCE_CHARS = 6_000
MAX_STDOUT_CHARS = 4_000


@dataclass
class SandboxResult:
    ok: bool
    stdout: str
    stderr: str
    exit_code: int | None
    elapsed_ms: float
    timed_out: bool = False
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_FORBIDDEN = (
    "import socket",
    "import urllib",
    "import requests",
    "import http",
    "from socket",
    "from urllib",
    "subprocess",
    "os.system",
    "ctypes",
    "shutil.rmtree",
    "__import__",
    "open('/",
    'open("/',
    "Path('/')",
    'Path("/")',
)


def run_python_snippet(
    source: str,
    *,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    allow_network: bool = False,
) -> SandboxResult:
    """Execute a short Python snippet in a throwaway cwd with a hard timeout."""
    started = time.perf_counter()
    cleaned = textwrap.dedent(source or "").strip()
    if not cleaned:
        return SandboxResult(
            ok=False,
            stdout="",
            stderr="",
            exit_code=None,
            elapsed_ms=0.0,
            error="empty source",
        )
    if len(cleaned) > MAX_SOURCE_CHARS:
        return SandboxResult(
            ok=False,
            stdout="",
            stderr="",
            exit_code=None,
            elapsed_ms=0.0,
            error=f"source exceeds {MAX_SOURCE_CHARS} chars",
        )
    lower = cleaned.lower()
    if not allow_network:
        for token in _FORBIDDEN:
            if token.lower() in lower:
                return SandboxResult(
                    ok=False,
                    stdout="",
                    stderr="",
                    exit_code=None,
                    elapsed_ms=0.0,
                    error=f"forbidden pattern: {token}",
                )

    timeout = max(0.4, min(float(timeout_s), 5.0))
    with tempfile.TemporaryDirectory(prefix="aether-sandbox-") as tmp:
        work = Path(tmp)
        script = work / "snippet.py"
        script.write_text(cleaned + "\n", encoding="utf-8")
        env = {
            "PYTHONUNBUFFERED": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
            "PATH": os.environ.get("PATH", ""),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "TEMP": str(work),
            "TMP": str(work),
        }
        # Strip secrets / API keys from child env.
        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script)],
                cwd=str(work),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            out = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
            err = (exc.stderr or "") if isinstance(exc.stderr, str) else "timeout"
            return SandboxResult(
                ok=False,
                stdout=out[:MAX_STDOUT_CHARS],
                stderr=err[:MAX_STDOUT_CHARS],
                exit_code=None,
                elapsed_ms=(time.perf_counter() - started) * 1000.0,
                timed_out=True,
                error=f"timeout after {timeout:.1f}s",
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("sandbox failed")
            return SandboxResult(
                ok=False,
                stdout="",
                stderr="",
                exit_code=None,
                elapsed_ms=(time.perf_counter() - started) * 1000.0,
                error=str(exc)[:240],
            )

        return SandboxResult(
            ok=proc.returncode == 0,
            stdout=(proc.stdout or "")[:MAX_STDOUT_CHARS],
            stderr=(proc.stderr or "")[:MAX_STDOUT_CHARS],
            exit_code=proc.returncode,
            elapsed_ms=(time.perf_counter() - started) * 1000.0,
            error=None if proc.returncode == 0 else "non-zero exit",
        )
