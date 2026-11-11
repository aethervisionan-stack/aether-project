"""CalendarBridge implementation backed by real Gmail + Google Calendar APIs."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.os_bridge.contracts import BridgeResult
from app.os_bridge.mock import MockCalendarBridge
from app.tools.google import calendar_ops, gmail_ops
from app.tools.google.clients import credentials_for

logger = logging.getLogger("aether.tools.google.bridge")


def google_credentials_ready(profile_id: str = "local") -> bool:
    try:
        return credentials_for(profile_id) is not None
    except Exception:  # noqa: BLE001
        return False


def _from_payload(payload: dict[str, Any]) -> BridgeResult:
    data = dict(payload.get("data") or {})
    return BridgeResult(
        ok=bool(payload.get("ok", True)),
        action=str(payload.get("action") or ""),
        detail=str(payload.get("detail") or ""),
        data=data,
        mock=False,
        error=payload.get("error"),
    )


class GoogleCalendarBridge:
    def __init__(self, *, profile_id: str = "local") -> None:
        self.profile_id = profile_id

    def _creds(self):
        creds = credentials_for(self.profile_id)
        if creds is None:
            raise RuntimeError("Google account not connected")
        return creds

    async def list_priority_email(self, *, limit: int = 5) -> BridgeResult:
        payload = await asyncio.to_thread(gmail_ops.list_priority_email, self._creds(), limit=limit)
        return _from_payload(payload)

    async def draft_email(self, *, to: str, subject: str, body: str) -> BridgeResult:
        payload = await asyncio.to_thread(
            gmail_ops.create_draft, self._creds(), to=to, subject=subject, body=body
        )
        return _from_payload(payload)

    async def send_draft(self, *, draft_id: str) -> BridgeResult:
        payload = await asyncio.to_thread(gmail_ops.send_draft, self._creds(), draft_id=draft_id)
        return _from_payload(payload)

    async def schedule_appointment(
        self,
        *,
        title: str,
        when: str,
        duration_min: int = 30,
        attendees: list[str] | None = None,
    ) -> BridgeResult:
        payload = await asyncio.to_thread(
            calendar_ops.schedule_appointment,
            self._creds(),
            title=title,
            when=when,
            duration_min=duration_min,
            attendees=attendees,
        )
        return _from_payload(payload)

    async def query_agenda(self, *, day: str = "today") -> BridgeResult:
        payload = await asyncio.to_thread(calendar_ops.query_agenda, self._creds(), day=day)
        return _from_payload(payload)

    async def delete_event(self, *, event_id: str) -> BridgeResult:
        payload = await asyncio.to_thread(calendar_ops.delete_event, self._creds(), event_id=event_id)
        return _from_payload(payload)


class HybridCalendarBridge:
    """Prefer live Google when tokens exist; otherwise MockCalendarBridge."""

    def __init__(self, *, profile_id: str = "local") -> None:
        self.profile_id = profile_id
        self._mock = MockCalendarBridge()
        self._google = GoogleCalendarBridge(profile_id=profile_id)

    def _use_google(self) -> bool:
        return google_credentials_ready(self.profile_id)

    async def list_priority_email(self, *, limit: int = 5) -> BridgeResult:
        if self._use_google():
            try:
                return await self._google.list_priority_email(limit=limit)
            except Exception as exc:  # noqa: BLE001
                return BridgeResult(ok=False, action="list_priority_email", error=str(exc)[:240], mock=False)
        return await self._mock.list_priority_email(limit=limit)

    async def draft_email(self, *, to: str, subject: str, body: str) -> BridgeResult:
        if self._use_google():
            try:
                return await self._google.draft_email(to=to, subject=subject, body=body)
            except Exception as exc:  # noqa: BLE001
                return BridgeResult(ok=False, action="draft_email", error=str(exc)[:240], mock=False)
        return await self._mock.draft_email(to=to, subject=subject, body=body)

    async def send_draft(self, *, draft_id: str) -> BridgeResult:
        if self._use_google():
            try:
                return await self._google.send_draft(draft_id=draft_id)
            except Exception as exc:  # noqa: BLE001
                return BridgeResult(ok=False, action="send_draft", error=str(exc)[:240], mock=False)
        return await self._mock.send_draft(draft_id=draft_id)

    async def schedule_appointment(
        self,
        *,
        title: str,
        when: str,
        duration_min: int = 30,
        attendees: list[str] | None = None,
    ) -> BridgeResult:
        if self._use_google():
            try:
                return await self._google.schedule_appointment(
                    title=title, when=when, duration_min=duration_min, attendees=attendees
                )
            except Exception as exc:  # noqa: BLE001
                return BridgeResult(ok=False, action="schedule_appointment", error=str(exc)[:240], mock=False)
        return await self._mock.schedule_appointment(
            title=title, when=when, duration_min=duration_min, attendees=attendees
        )

    async def query_agenda(self, *, day: str = "today") -> BridgeResult:
        if self._use_google():
            try:
                return await self._google.query_agenda(day=day)
            except Exception as exc:  # noqa: BLE001
                return BridgeResult(ok=False, action="query_agenda", error=str(exc)[:240], mock=False)
        return await self._mock.query_agenda(day=day)

    async def delete_event(self, *, event_id: str) -> BridgeResult:
        if self._use_google():
            try:
                return await self._google.delete_event(event_id=event_id)
            except Exception as exc:  # noqa: BLE001
                return BridgeResult(ok=False, action="delete_event", error=str(exc)[:240], mock=False)
        return await self._mock.delete_event(event_id=event_id)
