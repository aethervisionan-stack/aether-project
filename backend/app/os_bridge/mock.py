"""Mock / web / desktop OS bridge harness when native APIs are unavailable."""

from __future__ import annotations

import time
import uuid
from functools import lru_cache
from typing import Any

from app.os_bridge.contracts import (
    BridgeResult,
    CalendarBridge,
    MessagingApp,
    MediaAction,
    MessagingBridge,
    NotificationEvent,
    OsBridgeBundle,
    SoundMode,
    SystemControlBridge,
    TelephonyBridge,
    AccessibilityBridge,
)


def _ok(action: str, detail: str = "", **data: Any) -> BridgeResult:
    return BridgeResult(ok=True, action=action, detail=detail, data=dict(data), mock=True)


def _fail(action: str, error: str) -> BridgeResult:
    return BridgeResult(ok=False, action=action, error=error, mock=True)


class MockMessagingBridge:
    def __init__(self) -> None:
        self._sent: list[dict[str, Any]] = []

    async def read_threads(self, *, app: MessagingApp, limit: int = 10) -> BridgeResult:
        threads = [
            {"contact": "Carlos", "preview": "Você vai se atrasar?", "unread": 2},
            {"contact": "Ana", "preview": "Reunião às 15h", "unread": 1},
            {"contact": "Mom", "preview": "Chegou bem?", "unread": 0},
        ][: max(1, min(limit, 20))]
        return _ok("read_threads", f"{len(threads)} threads from {app}", app=app, threads=threads)

    async def summarize(self, *, app: MessagingApp, contact: str, limit: int = 5) -> BridgeResult:
        summary = (
            f"{contact} on {app}: last {limit} messages about timing and availability. "
            "Latest asks if you'll be late."
        )
        return _ok("summarize", summary, app=app, contact=contact, summary=summary)

    async def send_message(self, *, app: MessagingApp, contact: str, text: str) -> BridgeResult:
        entry = {
            "id": uuid.uuid4().hex[:10],
            "app": app,
            "contact": contact,
            "text": text,
            "at": time.time(),
        }
        self._sent.append(entry)
        return _ok("send_message", f"Sent to {contact} via {app}", message=entry)

    async def voice_reply(self, *, app: MessagingApp, contact: str, text: str) -> BridgeResult:
        return await self.send_message(app=app, contact=contact, text=text)


class MockCalendarBridge:
    def __init__(self) -> None:
        self._drafts: dict[str, dict[str, Any]] = {}
        self._events: dict[str, dict[str, Any]] = {
            "evt_standup": {
                "id": "evt_standup",
                "title": "Standup",
                "when": "today 10:00",
                "duration_min": 15,
            },
            "evt_design": {
                "id": "evt_design",
                "title": "Design review",
                "when": "today 15:00",
                "duration_min": 45,
            },
        }

    async def list_priority_email(self, *, limit: int = 5) -> BridgeResult:
        inbox = [
            {
                "from": "ceo@acme.io",
                "subject": "Q4 priorities",
                "preview": "Need your take before EOD",
                "priority": "high",
            },
            {
                "from": "billing@stripe.com",
                "subject": "Invoice ready",
                "preview": "Your receipt is available",
                "priority": "medium",
            },
            {
                "from": "news@digest.dev",
                "subject": "Weekly digest",
                "preview": "Top stories this week",
                "priority": "low",
            },
        ][: max(1, min(limit, 20))]
        return _ok("list_priority_email", f"{len(inbox)} priority emails", emails=inbox)

    async def draft_email(self, *, to: str, subject: str, body: str) -> BridgeResult:
        draft_id = f"draft_{uuid.uuid4().hex[:8]}"
        draft = {"id": draft_id, "to": to, "subject": subject, "body": body}
        self._drafts[draft_id] = draft
        return _ok("draft_email", f"Draft ready for {to}", draft=draft)

    async def send_draft(self, *, draft_id: str) -> BridgeResult:
        draft = self._drafts.pop(draft_id, None)
        if draft is None:
            return _fail("send_draft", f"unknown draft: {draft_id}")
        return _ok("send_draft", f"Email sent to {draft.get('to')}", draft=draft)

    async def schedule_appointment(
        self,
        *,
        title: str,
        when: str,
        duration_min: int = 30,
        attendees: list[str] | None = None,
    ) -> BridgeResult:
        event_id = f"evt_{uuid.uuid4().hex[:8]}"
        event = {
            "id": event_id,
            "title": title,
            "when": when,
            "duration_min": duration_min,
            "attendees": list(attendees or []),
        }
        self._events[event_id] = event
        return _ok("schedule_appointment", f"Scheduled '{title}' at {when}", event=event)

    async def query_agenda(self, *, day: str = "today") -> BridgeResult:
        items = list(self._events.values())
        return _ok("query_agenda", f"Agenda for {day}: {len(items)} items", day=day, agenda=items)

    async def delete_event(self, *, event_id: str) -> BridgeResult:
        event = self._events.pop(event_id, None)
        if event is None:
            return _fail("delete_event", f"unknown event: {event_id}")
        return _ok("delete_event", f"Deleted {event.get('title')}", event=event)


class MockTelephonyBridge:
    def __init__(self) -> None:
        self._incoming: dict[str, Any] | None = {
            "contact": "Carlos",
            "number": "+55 11 90000-0000",
            "at": time.time(),
        }

    async def incoming_call(self) -> BridgeResult:
        if self._incoming is None:
            return _ok("incoming_call", "No active incoming call", call=None)
        contact = str(self._incoming.get("contact") or "Unknown")
        prompt = f"{contact} is calling. Speaker or decline?"
        return _ok(
            "incoming_call",
            prompt,
            call=dict(self._incoming),
            speak=prompt,
        )

    async def answer(self, *, speaker: bool = False) -> BridgeResult:
        call = self._incoming
        self._incoming = None
        mode = "speaker" if speaker else "earpiece"
        return _ok("answer", f"Answered on {mode}", call=call, speaker=speaker)

    async def decline(self) -> BridgeResult:
        call = self._incoming
        self._incoming = None
        return _ok("decline", "Call declined", call=call)

    async def place_call(self, *, contact: str) -> BridgeResult:
        return _ok(
            "place_call",
            f"Calling {contact}",
            call={"contact": contact, "at": time.time()},
        )


class MockSystemControlBridge:
    def __init__(self) -> None:
        self.volume = 60
        self.sound_mode: SoundMode = "normal"
        self.playing = False
        self.battery_pct = 78

    async def media(self, *, action: MediaAction) -> BridgeResult:
        if action == "play":
            self.playing = True
        elif action in {"pause", "stop"}:
            self.playing = False
        return _ok("media", f"Media {action}", action=action, playing=self.playing)

    async def battery(self) -> BridgeResult:
        return _ok(
            "battery",
            f"Battery {self.battery_pct}%",
            percent=self.battery_pct,
            charging=False,
        )

    async def set_volume(self, *, level: int) -> BridgeResult:
        self.volume = max(0, min(100, int(level)))
        return _ok("set_volume", f"Volume {self.volume}%", level=self.volume)

    async def set_sound_mode(self, *, mode: SoundMode) -> BridgeResult:
        self.sound_mode = mode
        return _ok("set_sound_mode", f"Sound mode {mode}", mode=mode)

    async def set_timer(self, *, minutes: int, label: str = "") -> BridgeResult:
        return _ok(
            "set_timer",
            f"Timer {minutes} min" + (f" ({label})" if label else ""),
            minutes=minutes,
            label=label,
            timer_id=uuid.uuid4().hex[:8],
        )

    async def set_alarm(self, *, time_hhmm: str, label: str = "") -> BridgeResult:
        return _ok(
            "set_alarm",
            f"Alarm at {time_hhmm}" + (f" ({label})" if label else ""),
            time=time_hhmm,
            label=label,
            alarm_id=uuid.uuid4().hex[:8],
        )


class MockAccessibilityBridge:
    """Simulates notification interception without lighting the screen."""

    def __init__(self) -> None:
        self._queue: list[NotificationEvent] = []
        self._seed_demo()

    def _seed_demo(self) -> None:
        now = time.time()
        self._queue = [
            NotificationEvent(
                id=f"n_{uuid.uuid4().hex[:8]}",
                package="com.whatsapp",
                title="Carlos",
                body="Você vai se atrasar?",
                sender="Carlos",
                app="whatsapp",
                favorite=True,
                priority_hint="high",
                screen_lit=False,
                created_at=now,
            ),
            NotificationEvent(
                id=f"n_{uuid.uuid4().hex[:8]}",
                package="com.google.android.gm",
                title="Weekly digest",
                body="Top stories this week",
                sender="news@digest.dev",
                app="email",
                favorite=False,
                priority_hint="low",
                screen_lit=False,
                created_at=now,
            ),
        ]

    def platform(self) -> str:
        return "mock"

    async def poll_notifications(
        self, *, since_id: str | None = None
    ) -> list[NotificationEvent]:
        if not since_id:
            return list(self._queue)
        seen = False
        out: list[NotificationEvent] = []
        for ev in self._queue:
            if seen:
                out.append(ev)
            elif ev.id == since_id:
                seen = True
        return out

    async def dismiss_notification(self, *, notification_id: str) -> BridgeResult:
        before = len(self._queue)
        self._queue = [e for e in self._queue if e.id != notification_id]
        if len(self._queue) == before:
            return _fail("dismiss_notification", f"unknown id: {notification_id}")
        return _ok("dismiss_notification", f"Dismissed {notification_id}", id=notification_id)

    def inject(self, event: NotificationEvent) -> None:
        self._queue.append(event)


class MockOsBridgeBundle(OsBridgeBundle):
    def __init__(self) -> None:
        super().__init__(
            messaging=MockMessagingBridge(),
            calendar=MockCalendarBridge(),
            telephony=MockTelephonyBridge(),
            system=MockSystemControlBridge(),
            accessibility=MockAccessibilityBridge(),
            platform="mock",
        )


@lru_cache
def get_os_bridge() -> OsBridgeBundle:
    """Process-wide OS bridge — Google calendar/email when OAuth tokens exist."""
    from app.auth.google_oauth import get_google_oauth_service
    from app.tools.google.bridge import HybridCalendarBridge, google_credentials_ready

    bundle = MockOsBridgeBundle()
    bundle.calendar = HybridCalendarBridge(profile_id="local")
    original_status = bundle.status

    def status_with_google():
        base = original_status()
        live = google_credentials_ready("local")
        base["google"] = {
            "email_calendar_live": live,
            "oauth": get_google_oauth_service().status("local"),
        }
        if live:
            base["platform"] = "google"
            base["mock"] = False
        return base

    bundle.status = status_with_google  # type: ignore[method-assign]
    return bundle
