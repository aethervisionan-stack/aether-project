"""Test defaults: force mock audio so pytest does not require GEMINI_API_KEY."""

from __future__ import annotations

import os

# Must run before app.config Settings() is first constructed in imports.
os.environ.setdefault("USE_MOCK_AUDIO", "true")
os.environ.setdefault("PIPELINE_MODE", "mock")
os.environ.setdefault("STT_PROVIDER", "mock")
os.environ.setdefault("TTS_PROVIDER", "mock")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("MEMORY_ENABLED", "false")
