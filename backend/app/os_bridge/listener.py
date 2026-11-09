"""
Notification listener engine — intercepts alerts without lighting the screen.

Applies smart priority + favorite-contact filtering before HUD audio interrupt.
Reuses / extends mobility + hardware priority policy.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.hardware.audio_profile import AudioProfile, interruption_allows
from app.hardware.priority import PaceClass, PriorityPolicy, priority_policy
from app.mobility.notifications import NotificationAction, parse_notification
from app.os_bridge.contracts import NotificationEvent
from app.os_bridge.mock import get_os_bridge

# Extended levels used by the hands-free filter (maps onto critical/normal/secondary).
PriorityLevel = str  # low | medium | high | critical


@dataclass
class ListenerDecision:
    event: NotificationEvent
    action: NotificationAction
    level: PriorityLevel
    interrupt_audio: bool
    reason: str
    favorite: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "event": self.event.to_dict(),
            "action": self.action.to_dict(),
            "level": self.level,
            "interrupt_audio": self.interrupt_audio,
            "reason": self.reason,
            "favorite": self.favorite,
        }


@dataclass
class FavoriteStore:
    """Favorite contacts that always may interrupt (unless hard-muted)."""

    names: set[str] = field(default_factory=lambda: {"carlos", "ana", "mom", "mãe", "pai"})

    def is_favorite(self, sender: str | None) -> bool:
        if not sender:
            return False
        return sender.strip().lower() in self.names

    def add(self, name: str) -> None:
        cleaned = name.strip().lower()
        if cleaned:
            self.names.add(cleaned)

    def to_list(self) -> list[str]:
        return sorted(self.names)


def map_priority_level(
    *,
    hint: str | None,
    text: str,
    favorite: bool,
) -> PriorityLevel:
    """Normalize hints + urgency keywords → low/medium/high/critical."""
    raw = (hint or "").strip().lower()
    lower = (text or "").lower()
    if raw in {"critical", "urgent"} or any(
        k in lower for k in ("urgent", "urgente", "911", "sos", "emerg")
    ):
        return "critical"
    if raw in {"high", "high_priority"}:
        return "high"
    if raw in {"low", "secondary"} or any(
        k in lower for k in ("promo", "newsletter", "digest", "unsubscribe")
    ):
        return "high" if favorite else "low"
    if favorite:
        return "high"
    if raw in {"medium", "normal", ""}:
        return "medium"
    return "medium"


def level_to_legacy(level: PriorityLevel) -> str:
    """Map onto mobility NotificationAction.priority (critical|normal|secondary)."""
    if level == "critical":
        return "critical"
    if level == "high":
        return "critical"  # treat high as interruptible like critical for pace mute
    if level == "low":
        return "secondary"
    return "normal"


def should_interrupt_audio(
    *,
    level: PriorityLevel,
    favorite: bool,
    policy: PriorityPolicy,
    audio_profile: AudioProfile,
    filter_enabled: bool,
) -> tuple[bool, str]:
    """
    Interrupt audio only for medium/high (or critical) priority OR favorite contacts,
    still respecting pace / earbuds interruption filters.
    """
    if level == "low" and not favorite:
        return False, "low_priority"
    if favorite and level in {"low", "medium"}:
        # Favorites bump to at least medium interrupt eligibility.
        level = "medium"

    legacy = level_to_legacy(level if level != "medium" or not favorite else "high")
    if level == "medium":
        # Medium allowed when pace policy allows normal.
        if not policy.allows("normal"):
            return False, "pace_muted_medium"
        if not interruption_allows(
            profile=audio_profile,
            filter_enabled=filter_enabled,
            event_priority="normal",
        ):
            return False, "interruption_filter"
        return True, "medium_or_favorite"

    if level in {"high", "critical"}:
        if not policy.allows(legacy):
            # High maps to critical legacy — should still pass pace (critical always allowed).
            if not policy.allow_critical:
                return False, "pace_muted_high"
        if not interruption_allows(
            profile=audio_profile,
            filter_enabled=filter_enabled,
            event_priority="critical" if level == "critical" else "normal",
        ):
            # Earbuds: only critical barges; high+favorite still spoken as critical-ish.
            if level == "high" and favorite:
                return True, "favorite_high"
            if level == "critical":
                return True, "critical"
            if audio_profile.value in {"earbuds", "wearable"} and filter_enabled:
                return False, "earbuds_filter_high"
        return True, "high_or_critical"

    return False, "filtered"


class NotificationListenerEngine:
    """Backend engine + poll helper for accessibility-sourced alerts."""

    def __init__(self) -> None:
        self.favorites = FavoriteStore()
        self._history: list[ListenerDecision] = []

    def ingest_raw(
        self,
        *,
        source: str = "listener",
        title: str = "",
        body: str = "",
        raw: str | None = None,
        sender: str | None = None,
        package: str = "unknown",
        app: str | None = None,
        priority_hint: str | None = None,
        favorite: bool | None = None,
        screen_lit: bool = False,
        pace: PaceClass = PaceClass.STEADY,
        audio_profile: AudioProfile = AudioProfile.SPEAKER,
        interruption_filter: bool = True,
    ) -> ListenerDecision:
        fav = bool(favorite) if favorite is not None else self.favorites.is_favorite(sender)
        text = (raw or f"{title}\n{body}").strip()
        level = map_priority_level(hint=priority_hint, text=text, favorite=fav)
        action = parse_notification(
            source=source or app or package,
            title=title,
            body=body,
            raw=raw,
            sender=sender,
        )
        action.priority = level_to_legacy(level)
        event = NotificationEvent(
            id=action.id or f"n_{uuid.uuid4().hex[:8]}",
            package=package,
            title=action.title,
            body=action.body,
            sender=sender,
            app=app or source,
            favorite=fav,
            priority_hint=level,
            screen_lit=screen_lit,
            created_at=time.time(),
        )
        policy = priority_policy(pace, audio_profile)
        interrupt, reason = should_interrupt_audio(
            level=level,
            favorite=fav,
            policy=policy,
            audio_profile=audio_profile,
            filter_enabled=interruption_filter,
        )
        decision = ListenerDecision(
            event=event,
            action=action,
            level=level,
            interrupt_audio=interrupt,
            reason=reason,
            favorite=fav,
        )
        self._history.append(decision)
        self._history = self._history[-50:]
        return decision

    def ingest_event(
        self,
        event: NotificationEvent,
        *,
        pace: PaceClass = PaceClass.STEADY,
        audio_profile: AudioProfile = AudioProfile.SPEAKER,
        interruption_filter: bool = True,
    ) -> ListenerDecision:
        return self.ingest_raw(
            source=event.app or event.package,
            title=event.title,
            body=event.body,
            sender=event.sender,
            package=event.package,
            app=event.app,
            priority_hint=event.priority_hint,
            favorite=event.favorite,
            screen_lit=event.screen_lit,
            pace=pace,
            audio_profile=audio_profile,
            interruption_filter=interruption_filter,
        )

    async def poll_bridge(
        self,
        *,
        since_id: str | None = None,
        pace: PaceClass = PaceClass.STEADY,
        audio_profile: AudioProfile = AudioProfile.SPEAKER,
        interruption_filter: bool = True,
    ) -> list[ListenerDecision]:
        bridge = get_os_bridge()
        events = await bridge.accessibility.poll_notifications(since_id=since_id)
        return [
            self.ingest_event(
                ev,
                pace=pace,
                audio_profile=audio_profile,
                interruption_filter=interruption_filter,
            )
            for ev in events
        ]

    def history(self) -> list[dict[str, Any]]:
        return [d.to_dict() for d in self._history]


_LISTENER = NotificationListenerEngine()


def get_notification_listener() -> NotificationListenerEngine:
    return _LISTENER
