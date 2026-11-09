"""
Typed OS / accessibility bridge contracts.

Real Android AccessibilityService / iOS AX hooks implement these protocols.
Web/desktop uses Mock adapters (see mock.py). Keep payloads JSON-serializable.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Protocol, runtime_checkable

MessagingApp = Literal["whatsapp", "telegram", "sms", "instagram"]
SoundMode = Literal["normal", "vibrate", "silent"]
CallAction = Literal["answer", "decline", "speaker", "place"]
MediaAction = Literal["play", "pause", "next", "previous", "stop"]


@dataclass
class NotificationEvent:
    """Raw alert intercepted without lighting the screen (contract)."""

    id: str
    package: str
    title: str
    body: str
    sender: str | None = None
    app: str | None = None
    favorite: bool = False
    priority_hint: str | None = None  # low | medium | high | critical
    screen_lit: bool = False
    created_at: float = 0.0
    extras: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class BridgeResult:
    ok: bool
    action: str
    detail: str = ""
    data: dict[str, Any] = field(default_factory=dict)
    mock: bool = True
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@runtime_checkable
class MessagingBridge(Protocol):
    async def read_threads(
        self, *, app: MessagingApp, limit: int = 10
    ) -> BridgeResult: ...

    async def summarize(
        self, *, app: MessagingApp, contact: str, limit: int = 5
    ) -> BridgeResult: ...

    async def send_message(
        self, *, app: MessagingApp, contact: str, text: str
    ) -> BridgeResult: ...

    async def voice_reply(
        self, *, app: MessagingApp, contact: str, text: str
    ) -> BridgeResult: ...


@runtime_checkable
class CalendarBridge(Protocol):
    async def list_priority_email(self, *, limit: int = 5) -> BridgeResult: ...

    async def draft_email(
        self, *, to: str, subject: str, body: str
    ) -> BridgeResult: ...

    async def send_draft(self, *, draft_id: str) -> BridgeResult: ...

    async def schedule_appointment(
        self,
        *,
        title: str,
        when: str,
        duration_min: int = 30,
        attendees: list[str] | None = None,
    ) -> BridgeResult: ...

    async def query_agenda(self, *, day: str = "today") -> BridgeResult: ...

    async def delete_event(self, *, event_id: str) -> BridgeResult: ...


@runtime_checkable
class TelephonyBridge(Protocol):
    async def incoming_call(self) -> BridgeResult: ...

    async def answer(self, *, speaker: bool = False) -> BridgeResult: ...

    async def decline(self) -> BridgeResult: ...

    async def place_call(self, *, contact: str) -> BridgeResult: ...


@runtime_checkable
class SystemControlBridge(Protocol):
    async def media(self, *, action: MediaAction) -> BridgeResult: ...

    async def battery(self) -> BridgeResult: ...

    async def set_volume(self, *, level: int) -> BridgeResult: ...

    async def set_sound_mode(self, *, mode: SoundMode) -> BridgeResult: ...

    async def set_timer(self, *, minutes: int, label: str = "") -> BridgeResult: ...

    async def set_alarm(self, *, time_hhmm: str, label: str = "") -> BridgeResult: ...


@runtime_checkable
class AccessibilityBridge(Protocol):
    """Native accessibility entry — notification stream without waking screen."""

    async def poll_notifications(self, *, since_id: str | None = None) -> list[NotificationEvent]: ...

    async def dismiss_notification(self, *, notification_id: str) -> BridgeResult: ...

    def platform(self) -> str: ...


@dataclass
class OsBridgeBundle:
    messaging: MessagingBridge
    calendar: CalendarBridge
    telephony: TelephonyBridge
    system: SystemControlBridge
    accessibility: AccessibilityBridge
    platform: str = "mock"

    def status(self) -> dict[str, Any]:
        return {
            "platform": self.platform,
            "messaging": True,
            "email_calendar": True,
            "telephony": True,
            "system_control": True,
            "accessibility": True,
            "mock": self.platform in {"mock", "web", "desktop"},
        }
