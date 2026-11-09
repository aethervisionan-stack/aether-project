"""Dynamic hardware adaptation: earbuds audio profile + notification priority."""

from app.hardware.audio_profile import AudioProfile, interruption_allows, parse_audio_profile
from app.hardware.priority import PaceClass, classify_pace, priority_policy

__all__ = [
    "AudioProfile",
    "PaceClass",
    "classify_pace",
    "interruption_allows",
    "parse_audio_profile",
    "priority_policy",
]
