"""Registry handlers for google_drive_tool and google_maps_tool."""

from __future__ import annotations

import asyncio
from typing import Any

from app.config import Settings
from app.tools.google import drive_ops, maps_ops
from app.tools.google.clients import api_error_payload, require_creds


async def google_drive_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings
    action = str(args.get("action") or "search").strip() or "search"
    try:
        creds = require_creds(profile_id)
    except RuntimeError as exc:
        return {
            "ok": False,
            "tool": "google_drive_tool",
            "action": action,
            "error": str(exc),
            "auth_url": "/auth/google/start",
        }
    try:
        if action in {"search", "find"}:
            query = str(args.get("query") or args.get("q") or "").strip()
            if not query:
                return {"ok": False, "error": "query required", "tool": "google_drive_tool", "action": action}
            payload = await asyncio.to_thread(
                drive_ops.search_files, creds, query=query, limit=int(args.get("limit") or 10)
            )
            return {**payload, "tool": "google_drive_tool", "status": "ok"}
        if action in {"get", "metadata"}:
            file_id = str(args.get("file_id") or "").strip()
            if not file_id:
                return {"ok": False, "error": "file_id required", "tool": "google_drive_tool", "action": action}
            payload = await asyncio.to_thread(drive_ops.get_file_metadata, creds, file_id=file_id)
            return {**payload, "tool": "google_drive_tool", "status": "ok"}
    except Exception as exc:  # noqa: BLE001
        return api_error_payload(exc, tool="google_drive_tool", action=action)
    return {"ok": False, "error": f"unknown action: {action}", "tool": "google_drive_tool"}


async def google_maps_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del profile_id
    action = str(args.get("action") or "route").strip() or "route"
    try:
        if action in {"route", "directions"}:
            origin = str(args.get("origin") or "").strip()
            destination = str(args.get("destination") or args.get("dest") or "").strip()
            if not origin or not destination:
                return {
                    "ok": False,
                    "error": "origin and destination required",
                    "tool": "google_maps_tool",
                    "action": action,
                }
            payload = await asyncio.to_thread(
                maps_ops.directions,
                origin=origin,
                destination=destination,
                mode=str(args.get("mode") or "driving"),
                settings=settings,
            )
            return {**payload, "tool": "google_maps_tool", "status": "ok" if payload.get("ok") else "error"}
        if action in {"geocode", "reverse_geocode"}:
            address = str(args.get("address") or "").strip() or None
            lat = args.get("lat")
            lon = args.get("lon") or args.get("lng")
            payload = await asyncio.to_thread(
                maps_ops.geocode,
                address=address,
                lat=float(lat) if lat is not None else None,
                lon=float(lon) if lon is not None else None,
                settings=settings,
            )
            return {**payload, "tool": "google_maps_tool", "status": "ok" if payload.get("ok") else "error"}
        if action in {"geolocate", "locate", "user_location"}:
            payload = await asyncio.to_thread(maps_ops.geolocate, settings=settings)
            return {**payload, "tool": "google_maps_tool", "status": "ok"}
    except Exception as exc:  # noqa: BLE001
        return api_error_payload(exc, tool="google_maps_tool", action=action)
    return {"ok": False, "error": f"unknown action: {action}", "tool": "google_maps_tool"}
