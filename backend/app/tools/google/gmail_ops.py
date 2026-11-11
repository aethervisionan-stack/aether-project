"""Gmail API operations — threads, unread, draft, send."""

from __future__ import annotations

import base64
from email.mime.text import MIMEText
from typing import Any

from google.oauth2.credentials import Credentials

from app.tools.google.clients import build_gmail


def list_threads(creds: Credentials, *, query: str = "is:unread", limit: int = 5) -> dict[str, Any]:
    service = build_gmail(creds)
    resp = (
        service.users()
        .threads()
        .list(userId="me", q=query, maxResults=max(1, min(limit, 50)))
        .execute()
    )
    threads_out: list[dict[str, Any]] = []
    for item in resp.get("threads") or []:
        tid = item.get("id")
        if not tid:
            continue
        full = (
            service.users()
            .threads()
            .get(userId="me", id=tid, format="metadata", metadataHeaders=["From", "Subject", "Date"])
            .execute()
        )
        headers = _headers_from_thread(full)
        threads_out.append(
            {
                "id": tid,
                "snippet": full.get("snippet") or item.get("snippet") or "",
                "from": headers.get("From", ""),
                "subject": headers.get("Subject", ""),
                "date": headers.get("Date", ""),
                "unread": "UNREAD" in (full.get("messages") or [{}])[0].get("labelIds", []),
            }
        )
    return {
        "ok": True,
        "action": "list_threads",
        "detail": f"{len(threads_out)} threads",
        "data": {"threads": threads_out, "query": query},
        "mock": False,
    }


def list_unread(creds: Credentials, *, limit: int = 5) -> dict[str, Any]:
    result = list_threads(creds, query="is:unread", limit=limit)
    result["action"] = "unread"
    emails = [
        {
            "from": t.get("from"),
            "subject": t.get("subject"),
            "preview": t.get("snippet"),
            "priority": "high" if t.get("unread") else "medium",
            "thread_id": t.get("id"),
        }
        for t in (result.get("data") or {}).get("threads") or []
    ]
    result["data"] = {"emails": emails, "threads": (result.get("data") or {}).get("threads")}
    result["detail"] = f"{len(emails)} unread"
    return result


def list_priority_email(creds: Credentials, *, limit: int = 5) -> dict[str, Any]:
    result = list_threads(creds, query="is:unread OR is:important OR is:starred", limit=limit)
    result["action"] = "list_priority_email"
    emails = [
        {
            "from": t.get("from"),
            "subject": t.get("subject"),
            "preview": t.get("snippet"),
            "priority": "high",
            "thread_id": t.get("id"),
        }
        for t in (result.get("data") or {}).get("threads") or []
    ]
    result["data"] = {"emails": emails}
    result["detail"] = f"{len(emails)} priority emails"
    return result


def create_draft(creds: Credentials, *, to: str, subject: str, body: str) -> dict[str, Any]:
    service = build_gmail(creds)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    draft = service.users().drafts().create(userId="me", body={"message": {"raw": raw}}).execute()
    return {
        "ok": True,
        "action": "draft_email",
        "detail": f"Draft ready for {to}",
        "data": {
            "draft": {
                "id": draft.get("id"),
                "to": to,
                "subject": subject,
                "body": body,
                "message_id": (draft.get("message") or {}).get("id"),
            }
        },
        "mock": False,
    }


def send_draft(creds: Credentials, *, draft_id: str) -> dict[str, Any]:
    service = build_gmail(creds)
    sent = service.users().drafts().send(userId="me", body={"id": draft_id}).execute()
    return {
        "ok": True,
        "action": "send_draft",
        "detail": "Email sent",
        "data": {"message": sent, "draft_id": draft_id},
        "mock": False,
    }


def send_message(creds: Credentials, *, to: str, subject: str, body: str) -> dict[str, Any]:
    service = build_gmail(creds)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {
        "ok": True,
        "action": "send",
        "detail": f"Email sent to {to}",
        "data": {"message": sent},
        "mock": False,
    }


def _headers_from_thread(thread: dict[str, Any]) -> dict[str, str]:
    messages = thread.get("messages") or []
    if not messages:
        return {}
    headers = (messages[0].get("payload") or {}).get("headers") or []
    return {h.get("name", ""): h.get("value", "") for h in headers if h.get("name")}
