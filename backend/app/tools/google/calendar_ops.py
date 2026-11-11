"""Google Calendar API — list / create / delete events."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from google.oauth2.credentials import Credentials

from app.tools.google.clients import build_calendar

_HHMM = re.compile(r"(?P<h>\d{1,2}):(?P<m>\d{2})")


def query_agenda(creds: Credentials, *, day: str = "today") -> dict[str, Any]:
    service = build_calendar(creds)
    start, end = _day_window(day)
    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=50,
        )
        .execute()
    )
    items = []
    for ev in events_result.get("items") or []:
        start_raw = (ev.get("start") or {}).get("dateTime") or (ev.get("start") or {}).get("date")
        items.append(
            {
                "id": ev.get("id"),
                "title": ev.get("summary") or "(no title)",
                "when": start_raw,
                "end": (ev.get("end") or {}).get("dateTime") or (ev.get("end") or {}).get("date"),
                "html_link": ev.get("htmlLink"),
                "attendees": [a.get("email") for a in (ev.get("attendees") or []) if a.get("email")],
            }
        )
    return {
        "ok": True,
        "action": "query_agenda",
        "detail": f"Agenda for {day}: {len(items)} items",
        "data": {"day": day, "agenda": items},
        "mock": False,
    }


def schedule_appointment(
    creds: Credentials,
    *,
    title: str,
    when: str,
    duration_min: int = 30,
    attendees: list[str] | None = None,
) -> dict[str, Any]:
    service = build_calendar(creds)
    start = parse_when(when)
    end = start + timedelta(minutes=max(1, min(int(duration_min), 480)))
    body: dict[str, Any] = {
        "summary": title,
        "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
    }
    if attendees:
        body["attendees"] = [{"email": a} for a in attendees if "@" in a]
    created = service.events().insert(calendarId="primary", body=body).execute()
    event = {
        "id": created.get("id"),
        "title": created.get("summary") or title,
        "when": (created.get("start") or {}).get("dateTime") or when,
        "duration_min": duration_min,
        "attendees": list(attendees or []),
        "html_link": created.get("htmlLink"),
    }
    return {
        "ok": True,
        "action": "schedule_appointment",
        "detail": f"Scheduled '{title}' at {when}",
        "data": {"event": event},
        "mock": False,
    }


def delete_event(creds: Credentials, *, event_id: str) -> dict[str, Any]:
    service = build_calendar(creds)
    service.events().delete(calendarId="primary", eventId=event_id).execute()
    return {
        "ok": True,
        "action": "delete_event",
        "detail": f"Deleted {event_id}",
        "data": {"event": {"id": event_id}},
        "mock": False,
    }


def parse_when(when: str) -> datetime:
    raw = (when or "").strip()
    lower = raw.lower()
    now = datetime.now(timezone.utc)
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(raw.replace("Z", "+0000"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    base = now
    if "tomorrow" in lower or "amanhã" in lower or "amanha" in lower:
        base = now + timedelta(days=1)
    match = _HHMM.search(raw)
    if match:
        return base.replace(hour=int(match.group("h")) % 24, minute=int(match.group("m")), second=0, microsecond=0)
    return now + timedelta(hours=1)


def _day_window(day: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    lower = (day or "today").strip().lower()
    if lower in {"tomorrow", "amanhã", "amanha"}:
        start = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)
