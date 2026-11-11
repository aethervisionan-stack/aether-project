"""
Supabase-backed cloud sync for Aether Vision.

Auth / session / realtime HUD sync. Disabled when SUPABASE_URL is unset —
local MemoryStore + vector JSON continue to work offline.
"""

from app.cloud.status import cloud_status

__all__ = ["cloud_status"]
