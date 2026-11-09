"""Notification priority manager driven by movement pace telemetry."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from app.hardware.audio_profile import AudioProfile


class PaceClass(str, Enum):
    STEADY = "steady"
    FAST_TRAVEL = "fast_travel"
    RUNNING = "running"


def classify_pace(speed_mps: float | None) -> PaceClass:
    if speed_mps is None:
        return PaceClass.STEADY
    # ~ jogging starts ~2.2 m/s; cycling/car often > 5 m/s.
    if speed_mps >= 2.2 and speed_mps < 5.0:
        return PaceClass.RUNNING
    if speed_mps >= 5.0:
        return PaceClass.FAST_TRAVEL
    return PaceClass.STEADY


@dataclass(frozen=True)
class PriorityPolicy:
    pace: PaceClass
    audio_profile: AudioProfile
    allow_secondary: bool
    allow_normal: bool
    allow_critical: bool
    prefer_nav_cues: bool

    def allows(self, priority: str, *, is_nav_cue: bool = False) -> bool:
        if is_nav_cue and self.prefer_nav_cues:
            return True
        pri = (priority or "normal").lower()
        if pri == "critical":
            return self.allow_critical
        if pri == "secondary":
            return self.allow_secondary
        return self.allow_normal

    def prompt_block(self) -> str:
        if self.pace in {PaceClass.RUNNING, PaceClass.FAST_TRAVEL}:
            return (
                f"[hardware_priority] Pace={self.pace.value}, profile={self.audio_profile.value}. "
                "Silence secondary notifications. Prioritize only critical alerts and direct "
                "navigation cues. Keep spoken replies extremely short."
            )
        return (
            f"[hardware_priority] Pace={self.pace.value}, profile={self.audio_profile.value}. "
            "Normal notification priority; still prefer glanceable HUD lines."
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "pace": self.pace.value,
            "audio_profile": self.audio_profile.value,
            "allow_secondary": self.allow_secondary,
            "allow_normal": self.allow_normal,
            "allow_critical": self.allow_critical,
            "prefer_nav_cues": self.prefer_nav_cues,
        }


def priority_policy(pace: PaceClass, audio_profile: AudioProfile) -> PriorityPolicy:
    accelerated = pace in {PaceClass.RUNNING, PaceClass.FAST_TRAVEL}
    return PriorityPolicy(
        pace=pace,
        audio_profile=audio_profile,
        allow_secondary=not accelerated,
        allow_normal=not accelerated,
        allow_critical=True,
        prefer_nav_cues=True,
    )
