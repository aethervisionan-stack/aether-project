"""Per-WebSocket mobility / hardware session state (never on PCM hot path)."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from app.hardware.audio_profile import AudioProfile, parse_audio_profile
from app.hardware.priority import PaceClass, classify_pace, priority_policy
from app.mobility.copilot import CopilotMode, build_copilot_guidance, parse_copilot_mode
from app.mobility.geo import GeoFix, PlacePoint, build_nav_guidance, suggest_places


@dataclass
class MobilitySessionState:
    copilot_mode: CopilotMode = CopilotMode.ASSISTANT
    audio_profile: AudioProfile = AudioProfile.SPEAKER
    interruption_filter: bool = True
    last_fix: GeoFix | None = None
    places: list[PlacePoint] = field(default_factory=list)
    pace: PaceClass = PaceClass.STEADY
    speed_mps: float | None = None
    open_mic: bool = True
    ptt_enabled: bool = False
    updated_at: float = field(default_factory=time.time)

    def apply_config(self, payload: dict[str, Any]) -> None:
        if "copilot_mode" in payload:
            self.copilot_mode = parse_copilot_mode(payload.get("copilot_mode"))
        if "audio_profile" in payload:
            self.audio_profile = parse_audio_profile(payload.get("audio_profile"))
        if "interruption_filter" in payload:
            self.interruption_filter = bool(payload.get("interruption_filter"))
        if "open_mic" in payload:
            self.open_mic = bool(payload.get("open_mic"))
        if "ptt_enabled" in payload:
            self.ptt_enabled = bool(payload.get("ptt_enabled"))
        if "speed_mps" in payload:
            try:
                self.speed_mps = float(payload["speed_mps"]) if payload["speed_mps"] is not None else None
            except (TypeError, ValueError):
                pass
            self.pace = classify_pace(self.speed_mps)
        self.updated_at = time.time()

    def set_geo(self, raw: dict[str, Any]) -> GeoFix | None:
        fix = GeoFix.from_dict(raw)
        if fix is None:
            return None
        self.last_fix = fix
        if fix.speed_mps is not None:
            self.speed_mps = fix.speed_mps
            self.pace = classify_pace(fix.speed_mps)
        self.updated_at = time.time()
        return fix

    def upsert_place(self, raw: dict[str, Any]) -> PlacePoint | None:
        try:
            place = PlacePoint(
                id=str(raw.get("id") or f"p{int(time.time())}"),
                name=str(raw.get("name") or "Saved place").strip()[:80] or "Saved place",
                lat=float(raw["lat"]),
                lon=float(raw["lon"]),
                kind=str(raw.get("kind") or "saved"),
                at=float(raw.get("at") or time.time()),
            )
        except (KeyError, TypeError, ValueError):
            return None
        self.places = [p for p in self.places if p.id != place.id]
        self.places.append(place)
        self.places = self.places[-24:]
        self.updated_at = time.time()
        return place

    def runtime_blocks(self) -> list[str]:
        blocks: list[str] = [build_copilot_guidance(self.copilot_mode)]
        policy = priority_policy(self.pace, self.audio_profile)
        blocks.append(policy.prompt_block())
        if self.last_fix is not None:
            nearby = suggest_places(self.last_fix, self.places)
            nav = build_nav_guidance(self.last_fix, nearby=nearby)
            if nav.get("prompt_block"):
                blocks.append(str(nav["prompt_block"]))
        return blocks

    def to_dict(self) -> dict[str, Any]:
        return {
            "copilot_mode": self.copilot_mode.value,
            "audio_profile": self.audio_profile.value,
            "interruption_filter": self.interruption_filter,
            "pace": self.pace.value,
            "speed_mps": self.speed_mps,
            "open_mic": self.open_mic,
            "ptt_enabled": self.ptt_enabled,
            "fix": self.last_fix.to_dict() if self.last_fix else None,
            "places": [p.to_dict() for p in self.places],
            "updated_at": self.updated_at,
        }
