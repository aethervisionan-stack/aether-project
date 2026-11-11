"""Google Maps Platform — Directions + Geocoding (API key, not OAuth)."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import Settings, get_settings

DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GEOLOCATION_URL = "https://www.googleapis.com/geolocation/v1/geolocate"


def _api_key(settings: Settings | None = None) -> str:
    s = settings or get_settings()
    key = (s.google_maps_api_key or "").strip()
    if not key or "placeholder" in key.lower():
        raise RuntimeError(
            "GOOGLE_MAPS_API_KEY not configured — set a Maps Platform key "
            "(Directions + Geocoding). Never invent a key value."
        )
    return key


def _get_json(url: str, params: dict[str, str]) -> dict[str, Any]:
    full = f"{url}?{urlencode(params)}"
    req = Request(full, headers={"User-Agent": "aether-vision-live/0.4"})
    try:
        with urlopen(req, timeout=20) as resp:  # noqa: S310
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Maps HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Maps network error: {exc}") from exc


def _post_json(url: str, params: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    full = f"{url}?{urlencode(params)}"
    raw = json.dumps(body).encode("utf-8")
    req = Request(
        full,
        data=raw,
        headers={"User-Agent": "aether-vision-live/0.4", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=20) as resp:  # noqa: S310
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        body_txt = exc.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Geolocation HTTP {exc.code}: {body_txt}") from exc
    except URLError as exc:
        raise RuntimeError(f"Geolocation network error: {exc}") from exc


def directions(
    *, origin: str, destination: str, mode: str = "driving", settings: Settings | None = None
) -> dict[str, Any]:
    key = _api_key(settings)
    travel_mode = (mode or "driving").strip().lower()
    if travel_mode not in {"driving", "walking", "bicycling", "transit"}:
        travel_mode = "driving"
    payload = _get_json(
        DIRECTIONS_URL,
        {"origin": origin, "destination": destination, "mode": travel_mode, "key": key},
    )
    status = payload.get("status")
    if status != "OK":
        return {
            "ok": False,
            "action": "route",
            "error": f"Directions status={status}: {payload.get('error_message') or ''}".strip(),
            "mock": False,
        }
    routes_out: list[dict[str, Any]] = []
    for route in payload.get("routes") or []:
        leg0 = (route.get("legs") or [{}])[0]
        steps = [
            {
                "instruction": _strip_html(step.get("html_instructions") or ""),
                "distance": (step.get("distance") or {}).get("text"),
                "duration": (step.get("duration") or {}).get("text"),
            }
            for step in (leg0.get("steps") or [])
        ]
        routes_out.append(
            {
                "summary": route.get("summary"),
                "distance": (leg0.get("distance") or {}).get("text"),
                "duration": (leg0.get("duration") or {}).get("text"),
                "start_address": leg0.get("start_address"),
                "end_address": leg0.get("end_address"),
                "steps": steps[:20],
            }
        )
    primary = routes_out[0] if routes_out else {}
    return {
        "ok": True,
        "action": "route",
        "detail": f"{primary.get('duration')} · {primary.get('distance')}",
        "data": {
            "origin": origin,
            "destination": destination,
            "mode": travel_mode,
            "routes": routes_out,
        },
        "mock": False,
    }


def geocode(
    *,
    address: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    key = _api_key(settings)
    params: dict[str, str] = {"key": key}
    if address:
        params["address"] = address
    elif lat is not None and lon is not None:
        params["latlng"] = f"{lat},{lon}"
    else:
        return {"ok": False, "action": "geocode", "error": "provide address or lat+lon", "mock": False}
    payload = _get_json(GEOCODE_URL, params)
    status = payload.get("status")
    if status != "OK":
        return {
            "ok": False,
            "action": "geocode",
            "error": f"Geocode status={status}: {payload.get('error_message') or ''}".strip(),
            "mock": False,
        }
    results = []
    for item in payload.get("results") or []:
        loc = (item.get("geometry") or {}).get("location") or {}
        results.append(
            {
                "formatted_address": item.get("formatted_address"),
                "lat": loc.get("lat"),
                "lon": loc.get("lng"),
                "place_id": item.get("place_id"),
                "types": item.get("types") or [],
            }
        )
    return {
        "ok": True,
        "action": "geocode",
        "detail": results[0]["formatted_address"] if results else "geocoded",
        "data": {"results": results},
        "mock": False,
    }


def geolocate(*, settings: Settings | None = None) -> dict[str, Any]:
    key = _api_key(settings)
    payload = _post_json(GEOLOCATION_URL, {"key": key}, {"considerIp": True})
    loc = payload.get("location") or {}
    return {
        "ok": True,
        "action": "geolocate",
        "detail": f"lat={loc.get('lat')}, lon={loc.get('lng')}",
        "data": {"lat": loc.get("lat"), "lon": loc.get("lng"), "accuracy_m": payload.get("accuracy")},
        "mock": False,
    }


def _strip_html(text: str) -> str:
    out: list[str] = []
    in_tag = False
    for ch in text:
        if ch == "<":
            in_tag = True
            continue
        if ch == ">":
            in_tag = False
            continue
        if not in_tag:
            out.append(ch)
    return "".join(out).replace("&nbsp;", " ").strip()
