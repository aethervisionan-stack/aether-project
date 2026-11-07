"""GET /audio/{filename} — stream persisted TTS MP3/WAV for client autoplay."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.audio_store import resolve_audio_file

router = APIRouter(tags=["audio"])


@router.get(
    "/audio/{filename}",
    summary="Download or stream a synthesized TTS file",
    responses={404: {"description": "Audio file not found"}},
)
async def get_audio(filename: str) -> FileResponse:
    path = resolve_audio_file(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")
    media = "audio/mpeg" if path.suffix.lower() == ".mp3" else "audio/wav"
    return FileResponse(
        path,
        media_type=media,
        filename=path.name,
        headers={"Cache-Control": "private, max-age=3600"},
    )
