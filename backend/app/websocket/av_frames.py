"""Binary multimodal frame envelope for /ws/live (AVF1)."""

from __future__ import annotations

from dataclasses import dataclass


AVF1_MAGIC = b"AVF1"
MAX_MIME_LEN = 64
MAX_RAW_BYTES = 180_000


@dataclass(frozen=True)
class ParsedAvFrame:
    mime: str
    data: bytes


def try_parse_av_frame(raw: bytes) -> ParsedAvFrame | None:
    """
    Parse AVF1 binary envelope.

    Layout: magic(4) + mime_len(u8) + mime(utf-8) + payload
    Returns None when buffer is ordinary PCM (no magic).
    """
    if not raw or len(raw) < 6 or raw[:4] != AVF1_MAGIC:
        return None
    mime_len = raw[4]
    if mime_len < 1 or mime_len > MAX_MIME_LEN:
        return None
    end = 5 + mime_len
    if end > len(raw):
        return None
    try:
        mime = raw[5:end].decode("utf-8").strip() or "image/jpeg"
    except UnicodeDecodeError:
        mime = "image/jpeg"
    payload = raw[end:]
    if not payload:
        return None
    if len(payload) > MAX_RAW_BYTES:
        payload = payload[:MAX_RAW_BYTES]
    if not mime.startswith("image/"):
        mime = "image/jpeg"
    return ParsedAvFrame(mime=mime, data=payload)
