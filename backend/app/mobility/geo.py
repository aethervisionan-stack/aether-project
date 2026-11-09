"""Conversational navigation helpers: GPS context, place history, step audio cues."""

from __future__ import annotations

import math
import time
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class GeoFix:
    lat: float
    lon: float
    accuracy_m: float | None = None
    speed_mps: float | None = None
    heading_deg: float | None = None
    label: str | None = None
    at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> GeoFix | None:
        if not isinstance(raw, dict):
            return None
        try:
            lat = float(raw["lat"])
            lon = float(raw["lon"])
        except (KeyError, TypeError, ValueError):
            return None
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            return None
        return cls(
            lat=lat,
            lon=lon,
            accuracy_m=_opt_float(raw.get("accuracy_m")),
            speed_mps=_opt_float(raw.get("speed_mps")),
            heading_deg=_opt_float(raw.get("heading_deg")),
            label=str(raw["label"]) if raw.get("label") else None,
            at=float(raw.get("at") or time.time()),
        )


@dataclass
class PlacePoint:
    id: str
    name: str
    lat: float
    lon: float
    kind: str = "saved"  # saved | meeting | recent
    at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def haversine_m(a: GeoFix | PlacePoint, b: GeoFix | PlacePoint) -> float:
    r = 6_371_000.0
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def suggest_places(
    fix: GeoFix | None,
    places: list[PlacePoint],
    *,
    limit: int = 3,
    radius_m: float = 5_000.0,
) -> list[dict[str, Any]]:
    if fix is None or not places:
        return []
    ranked: list[tuple[float, PlacePoint]] = []
    for place in places:
        dist = haversine_m(fix, place)
        if dist <= radius_m:
            ranked.append((dist, place))
    ranked.sort(key=lambda t: t[0])
    out: list[dict[str, Any]] = []
    for dist, place in ranked[:limit]:
        item = place.to_dict()
        item["distance_m"] = round(dist)
        out.append(item)
    return out


def build_nav_guidance(
    fix: GeoFix | None,
    *,
    destination: PlacePoint | None = None,
    nearby: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Simplified step-by-step audio guidance payload for the assistant."""
    if fix is None:
        return {
            "ok": False,
            "prompt_block": "Geolocation unavailable. Ask the user to enable GPS or share a destination.",
            "steps": [],
        }

    lines = [
        f"User GPS: lat={fix.lat:.5f}, lon={fix.lon:.5f}"
        + (f", accuracy≈{fix.accuracy_m:.0f}m" if fix.accuracy_m is not None else "")
        + (f", speed≈{fix.speed_mps:.1f}m/s" if fix.speed_mps is not None else "")
        + "."
    ]
    steps: list[str] = []
    if destination is not None:
        dist = haversine_m(fix, destination)
        bearing = _bearing_deg(fix, destination)
        cardinal = _cardinal(bearing)
        steps = [
            f"Head {cardinal} toward {destination.name}.",
            f"Remaining distance about {_human_distance(dist)}.",
            "Continue until the next turn cue; keep answers short for earbuds.",
        ]
        lines.append(
            f"Destination: {destination.name} ({dist:.0f} m, bearing {bearing:.0f}° {cardinal})."
        )
    elif nearby:
        names = ", ".join(
            f"{p.get('name')} ({p.get('distance_m')}m)" for p in nearby[:3]
        )
        lines.append(f"Nearby saved/meeting points: {names}.")
        steps = [
            "Offer the closest saved place or upcoming meeting.",
            "If the user picks one, give one short turn-by-turn cue at a time.",
        ]
    else:
        steps = [
            "Acknowledge current position briefly.",
            "Ask for a destination or offer to save this spot.",
        ]

    prompt_block = "\n".join(
        ["[geo_context]"] + lines + ["[nav_steps]"] + [f"- {s}" for s in steps]
    )
    return {
        "ok": True,
        "fix": fix.to_dict(),
        "destination": destination.to_dict() if destination else None,
        "nearby": nearby or [],
        "steps": steps,
        "prompt_block": prompt_block,
    }


def _bearing_deg(a: GeoFix, b: PlacePoint) -> float:
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def _cardinal(bearing: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[int((bearing + 22.5) // 45) % 8]


def _human_distance(meters: float) -> str:
    if meters < 1000:
        return f"{int(round(meters))} meters"
    return f"{meters / 1000.0:.1f} km"


def _opt_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
