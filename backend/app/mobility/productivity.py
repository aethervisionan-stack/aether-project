"""Active productivity voice commands: reminders, insight notes, appointments."""

from __future__ import annotations

import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

IntentKind = Literal["reminder", "note", "appointment", "unknown"]


@dataclass
class ProductivityIntent:
    id: str
    kind: IntentKind
    title: str
    detail: str
    when_hint: str | None = None
    memory_note: str | None = None
    ok: bool = True
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_REMINDER_RE = re.compile(
    r"^(?:remind me|lembra(?:r)?(?:[- ]me)?|me lembra|set a reminder)\s*(?:to|de|que)?\s*(.+)$",
    re.IGNORECASE,
)
_NOTE_RE = re.compile(
    r"^(?:note|nota|insight|anota(?:r)?|save note|salva(?:r)? nota)\s*[:\-]?\s*(.+)$",
    re.IGNORECASE,
)
_APPT_RE = re.compile(
    r"^(?:schedule|agendar?|marcar|book|appointment|reuni[aã]o)\s*(?:a|an|um|uma)?\s*(.+)$",
    re.IGNORECASE,
)
_WHEN_RE = re.compile(
    r"\b(?:at|às|as|em|on|tomorrow|amanhã|hoje|today|in \d+\s*(?:min|minutes|mins|h|hours?))\b.*$",
    re.IGNORECASE,
)


def parse_productivity_command(text: str) -> ProductivityIntent:
    cleaned = (text or "").strip()
    if not cleaned:
        return ProductivityIntent(
            id=uuid.uuid4().hex[:10],
            kind="unknown",
            title="",
            detail="",
            ok=False,
        )

    m = _REMINDER_RE.match(cleaned)
    if m:
        body = m.group(1).strip()
        when = _extract_when(body)
        title = _strip_when(body)
        return ProductivityIntent(
            id=uuid.uuid4().hex[:10],
            kind="reminder",
            title=title[:120] or "Reminder",
            detail=body[:400],
            when_hint=when,
            memory_note=f"Reminder: {title}" + (f" ({when})" if when else ""),
        )

    m = _NOTE_RE.match(cleaned)
    if m:
        body = m.group(1).strip()
        return ProductivityIntent(
            id=uuid.uuid4().hex[:10],
            kind="note",
            title=_clip(body, 80) or "Insight note",
            detail=body[:600],
            memory_note=f"Insight note: {body[:280]}",
        )

    m = _APPT_RE.match(cleaned)
    if m:
        body = m.group(1).strip()
        when = _extract_when(body)
        title = _strip_when(body)
        return ProductivityIntent(
            id=uuid.uuid4().hex[:10],
            kind="appointment",
            title=title[:120] or "Appointment",
            detail=body[:400],
            when_hint=when,
            memory_note=f"Appointment: {title}" + (f" @ {when}" if when else ""),
        )

    return ProductivityIntent(
        id=uuid.uuid4().hex[:10],
        kind="unknown",
        title="",
        detail=cleaned[:400],
        ok=False,
    )


def _extract_when(text: str) -> str | None:
    m = _WHEN_RE.search(text)
    if not m:
        return None
    return m.group(0).strip()[:80] or None


def _strip_when(text: str) -> str:
    return _WHEN_RE.sub("", text).strip(" ,.-") or text.strip()


def _clip(value: str, n: int) -> str:
    s = value.strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"
