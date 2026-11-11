"""
Two-step voice confirmation loop for irreversible OS actions.

1) Intent capture → pending action + spoken summary
2) On confirmation words → execute + success signal
Never auto-execute irreversible actions without this loop.
"""

from __future__ import annotations

import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

# PT / EN / ES confirmation + rejection phrases (barge-in / VAD friendly).
CONFIRM_PHRASES: tuple[str, ...] = (
    "sim",
    "yes",
    "sí",
    "si",
    "ok",
    "okay",
    "pode enviar",
    "pode",
    "confirma",
    "confirmar",
    "confirm",
    "confirmed",
    "go ahead",
    "send it",
    "do it",
    "execute",
    "envia",
    "enviar",
    "manda",
    "mandar",
    "agendar",
    "agenda",
    "aprova",
    "aprovar",
    "afirmativo",
)

REJECT_PHRASES: tuple[str, ...] = (
    "não",
    "nao",
    "no",
    "cancel",
    "cancelar",
    "cancela",
    "stop",
    "para",
    "desist",
    "nega",
    "decline",
    "abort",
)

# Tool actions that must never auto-execute.
IRREVERSIBLE: frozenset[tuple[str, str]] = frozenset(
    {
        ("messaging_tool", "send"),
        ("messaging_tool", "voice_reply"),
        ("email_calendar_tool", "send_draft"),
        ("email_calendar_tool", "schedule"),
        ("email_calendar_tool", "delete"),
        ("telephony_tool", "place_call"),
        ("telephony_tool", "answer"),
        ("telephony_tool", "decline"),
        ("system_control_tool", "delete_alarm"),
        ("system_control_tool", "desktop_capture"),
        ("system_control_tool", "notification_read"),
        ("system_control_tool", "keyboard"),
        ("system_control_tool", "mouse"),
        ("system_control_tool", "click"),
        ("system_control_tool", "type"),
        ("system_control_tool", "hotkey"),
    }
)

_WORD = re.compile(r"[^\wÀ-ÿ]+", re.UNICODE)


@dataclass
class PendingAction:
    id: str
    tool: str
    action: str
    arguments: dict[str, Any]
    speak: str
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    profile_id: str = "local"
    source: str = "ws"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def requires_confirmation(tool: str, action: str, *, confirmed: bool = False) -> bool:
    if confirmed:
        return False
    return (tool, action) in IRREVERSIBLE


def build_speak_summary(tool: str, action: str, args: dict[str, Any]) -> str:
    """Human-spoken preview of what will be done (step 2 of the loop)."""
    if tool == "messaging_tool":
        contact = str(args.get("contact") or "contact")
        app = str(args.get("app") or "messaging")
        text = str(args.get("text") or "").strip()
        clip = text if len(text) <= 80 else text[:77] + "…"
        if action == "voice_reply":
            return f"Vou responder {contact} no {app}: «{clip}». Confirma?"
        return f"Vou enviar para {contact} no {app}: «{clip}». Posso enviar?"
    if tool == "email_calendar_tool":
        if action == "schedule":
            title = str(args.get("title") or "appointment")
            when = str(args.get("when") or "")
            return f"Vou agendar «{title}»{(' em ' + when) if when else ''}. Confirma?"
        if action == "delete":
            return f"Vou apagar o evento {args.get('event_id') or ''}. Confirma?"
        if action == "send_draft":
            return f"Vou enviar o rascunho {args.get('draft_id') or ''}. Posso enviar?"
    if tool == "telephony_tool":
        contact = str(args.get("contact") or "the caller")
        if action == "place_call":
            return f"Vou ligar para {contact}. Confirma?"
        if action == "answer":
            speaker = " no alto-falante" if args.get("speaker") else ""
            return f"Vou atender{speaker}. Confirma?"
        if action == "decline":
            return "Vou recusar a chamada. Confirma?"
    if tool == "system_control_tool":
        if action == "delete_alarm":
            return f"Vou apagar o alarme {args.get('alarm_id') or ''}. Confirma?"
        if action in {"desktop_capture", "capture", "screenshot"}:
            return "Vou capturar a tela do desktop. Confirma?"
        if action in {"notification_read", "notifications", "read_notifications"}:
            return "Vou ler as notificações visíveis. Confirma?"
        if action in {"keyboard", "type", "hotkey"}:
            preview = str(args.get("text") or "+".join(args.get("keys") or []) or "")
            clip = preview if len(preview) <= 60 else preview[:57] + "…"
            return f"Vou usar o teclado{(': «' + clip + '»') if clip else ''}. Confirma?"
        if action in {"mouse", "click", "move", "scroll"}:
            return (
                f"Vou controlar o mouse"
                f" ({args.get('mode') or action}"
                f"{(' @' + str(args.get('x')) + ',' + str(args.get('y'))) if args.get('x') is not None else ''}"
                f"). Confirma?"
            )
    return f"Vou executar {tool}.{action}. Confirma?"


def normalize_utterance(text: str) -> str:
    return _WORD.sub(" ", (text or "").strip().lower()).strip()


def is_confirmation_utterance(text: str) -> bool:
    norm = normalize_utterance(text)
    if not norm:
        return False
    if is_rejection_utterance(text):
        return False
    # Exact short phrases or contained multi-word confirms.
    if norm in CONFIRM_PHRASES:
        return True
    for phrase in CONFIRM_PHRASES:
        if " " in phrase and phrase in norm:
            return True
    # Single-token confirm amid short barge-in ("sim pode", "yes send").
    tokens = set(norm.split())
    return bool(tokens & {p for p in CONFIRM_PHRASES if " " not in p})


def is_rejection_utterance(text: str) -> bool:
    norm = normalize_utterance(text)
    if not norm:
        return False
    if norm in REJECT_PHRASES:
        return True
    tokens = set(norm.split())
    return bool(tokens & set(REJECT_PHRASES))


class ConfirmationEngine:
    """In-memory pending irreversible actions awaiting voice/tap confirm."""

    def __init__(self, *, ttl_s: float = 90.0) -> None:
        self._pending: dict[str, PendingAction] = {}
        self.ttl_s = ttl_s

    def purge_expired(self) -> None:
        now = time.time()
        dead = [k for k, v in self._pending.items() if v.expires_at and v.expires_at < now]
        for k in dead:
            self._pending.pop(k, None)

    def create(
        self,
        *,
        tool: str,
        action: str,
        arguments: dict[str, Any],
        profile_id: str = "local",
        source: str = "ws",
        speak: str | None = None,
    ) -> PendingAction:
        self.purge_expired()
        pending = PendingAction(
            id=f"pc_{uuid.uuid4().hex[:10]}",
            tool=tool,
            action=action,
            arguments=dict(arguments or {}),
            speak=speak or build_speak_summary(tool, action, arguments or {}),
            expires_at=time.time() + self.ttl_s,
            profile_id=profile_id,
            source=source,
        )
        self._pending[pending.id] = pending
        return pending

    def get(self, pending_id: str) -> PendingAction | None:
        self.purge_expired()
        return self._pending.get(pending_id)

    def pop(self, pending_id: str) -> PendingAction | None:
        self.purge_expired()
        return self._pending.pop(pending_id, None)

    def latest_for_profile(self, profile_id: str) -> PendingAction | None:
        self.purge_expired()
        items = [p for p in self._pending.values() if p.profile_id == profile_id]
        if not items:
            return None
        return max(items, key=lambda p: p.created_at)

    def list_pending(self, profile_id: str | None = None) -> list[PendingAction]:
        self.purge_expired()
        items = list(self._pending.values())
        if profile_id is not None:
            items = [p for p in items if p.profile_id == profile_id]
        return sorted(items, key=lambda p: p.created_at, reverse=True)


# Process-wide engine (one pending queue per backend process).
_ENGINE = ConfirmationEngine()


def get_confirmation_engine() -> ConfirmationEngine:
    return _ENGINE
