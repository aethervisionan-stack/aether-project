"""Google Drive API — readonly search."""

from __future__ import annotations

from typing import Any

from google.oauth2.credentials import Credentials

from app.tools.google.clients import build_drive


def search_files(creds: Credentials, *, query: str, limit: int = 10) -> dict[str, Any]:
    service = build_drive(creds)
    q = (query or "").strip()
    safe = q.replace("'", "\\'")
    drive_q = f"fullText contains '{safe}' and trashed = false" if safe else "trashed = false"
    resp = (
        service.files()
        .list(
            q=drive_q,
            pageSize=max(1, min(int(limit), 50)),
            fields="files(id, name, mimeType, modifiedTime, webViewLink, owners, size)",
            spaces="drive",
        )
        .execute()
    )
    files = [
        {
            "id": f.get("id"),
            "name": f.get("name"),
            "mime_type": f.get("mimeType"),
            "modified": f.get("modifiedTime"),
            "web_view_link": f.get("webViewLink"),
            "size": f.get("size"),
        }
        for f in (resp.get("files") or [])
    ]
    return {
        "ok": True,
        "action": "search",
        "detail": f"{len(files)} Drive files",
        "data": {"files": files, "query": q},
        "mock": False,
    }


def get_file_metadata(creds: Credentials, *, file_id: str) -> dict[str, Any]:
    service = build_drive(creds)
    meta = (
        service.files()
        .get(
            fileId=file_id,
            fields="id, name, mimeType, modifiedTime, webViewLink, owners, size, description",
        )
        .execute()
    )
    return {
        "ok": True,
        "action": "get",
        "detail": meta.get("name") or file_id,
        "data": {"file": meta},
        "mock": False,
    }
