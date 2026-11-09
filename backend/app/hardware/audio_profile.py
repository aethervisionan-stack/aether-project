"""Earbuds / speaker audio profile with intelligent interruption filtering."""

from __future__ import annotations

from enum import Enum
from typing import Any


class AudioProfile(str, Enum):
    SPEAKER = "speaker"
    EARBUDS = "earbuds"
    WEARABLE = "wearable"


def parse_audio_profile(raw: Any) -> AudioProfile:
    value = str(raw or "").strip().lower()
    if value in {AudioProfile.EARBUDS.value, "headphones", "headset", "airpods"}:
        return AudioProfile.EARBUDS
    if value in {AudioProfile.WEARABLE.value, "watch", "glasses", "frame"}:
        return AudioProfile.WEARABLE
    return AudioProfile.SPEAKER


def interruption_allows(
    *,
    profile: AudioProfile,
    filter_enabled: bool,
    event_priority: str,
    is_nav_cue: bool = False,
) -> bool:
    """
    Decide whether an interruption (notification TTS / secondary cue) may barge in.

    Earbuds/wearables: filter secondary chatter; always allow critical + nav.
    """
    if not filter_enabled:
        return True
    pri = (event_priority or "normal").lower()
    if pri == "critical" or is_nav_cue:
        return True
    if profile in {AudioProfile.EARBUDS, AudioProfile.WEARABLE}:
        return pri == "critical"
    # Speaker: allow normal, drop secondary.
    return pri != "secondary"
