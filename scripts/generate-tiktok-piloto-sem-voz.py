#!/usr/bin/env python3
"""
Gera 1 vídeo-piloto TikTok (9:16) — SEM voz / SEM TTS.

- Carta em destaque + Ken Burns
- Música de fundo baixa (royalty-free do repo)
- Só gancho + CTA “link na bio” (sem nome de arquétipo)
- Overlay discreto (topo / terço inferior), área segura TikTok

Uso:
  python scripts/generate-tiktok-piloto-sem-voz.py
  python scripts/generate-tiktok-piloto-sem-voz.py --card mago.jpg --duration 14
"""

from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

# Reusa helpers do pipeline principal (ffmpeg, palette, ASS utils)
_PIPE_PATH = SCRIPT_DIR / "generate-tiktok-archetype-videos.py"
_spec = importlib.util.spec_from_file_location("tiktok_pipe", _PIPE_PATH)
if _spec is None or _spec.loader is None:
    raise SystemExit(f"Não carreguei {_PIPE_PATH}")
pipe = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pipe)

CARDS_DIR = REPO_ROOT / "public" / "images" / "archetypes"
AUDIO_PATH = REPO_ROOT / "public" / "audio" / "dark-and-darker-lobby.mp3"
DEFAULT_OUT_DIR = Path(r"C:\Users\Next\Desktop\projeto quiz medieval\editado\piloto")
DEFAULT_OUT_NAME = "piloto-carta-sem-voz.mp4"

WIDTH = pipe.WIDTH
HEIGHT = pipe.HEIGHT
FPS = pipe.FPS
MUSIC_VOLUME = 0.14  # baixo, sem voz
FADE_OUT_SEC = 1.4

# Opções testadas (v2) — vencedor = orgulho/exaustão (confronto 0–2s)
# A (vencedor): orgulho de aguentar → medo de parar
# B: "De novo. O mesmo ciclo. / Você já sabia / antes de começar."
# C: "Você sabota o que mais quer / e chama isso de destino."
HOOK_PUNCH = "Você se orgulha de aguentar."  # só a 1ª linha, 0–~1.8s
HOOK_LINES = (
    "Você se orgulha de aguentar.",
    "Isso não é força.",
    "É medo de parar.",
)
CTA_LINES = (
    "Puxe sua carta",
    "no link da bio.",
)

# Margens ASS — área segura TikTok
HOOK_FONT = 54
CTA_FONT = 48
HOOK_MARGIN_V = 175  # topo (Alignment 8)
CTA_MARGIN_V = 420  # base (Alignment 2)
MARGIN_LR = 96
OUTLINE = 2.4
SHADOW = 2.6
PUNCH_END_SEC = 1.85  # confronto imediato nos primeiros ~2s
HOOK_FULL_START_SEC = 1.85


def ass_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )


def write_piloto_ass(
    path: Path,
    *,
    duration: float,
    text_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
) -> None:
    """Overlay discreto: gancho no topo, CTA no terço inferior. Sem caixa opaca."""
    font = pipe.pick_ass_font()
    stroke = pipe.rgb_to_ass((10, 8, 6), alpha=0)
    shadow = pipe.rgb_to_ass((0, 0, 0), alpha=0x55)
    hook_fill = pipe.lighten_for_text(text_rgb, min_v=0.93)
    cta_fill = pipe.lighten_for_text(accent_rgb, min_v=0.88)
    if pipe.contrast_ratio(cta_fill, (18, 16, 14)) < 3.0:
        cta_fill = pipe.lighten_for_text(accent_rgb, min_v=0.94)

    punch_text = ass_escape(HOOK_PUNCH)
    hook_text = ass_escape("\n".join(HOOK_LINES))
    cta_text = ass_escape("\n".join(CTA_LINES))

    # Punch 0–2s → gancho completo; CTA entra no meio
    hook_end = max(duration - 0.35, duration * 0.92)
    cta_start = min(5.0, duration * 0.36)
    punch_end = min(PUNCH_END_SEC, duration * 0.2)
    hook_full_start = min(HOOK_FULL_START_SEC, punch_end)

    stroke_tag = pipe.ass_color_no_alpha((10, 8, 6))
    shadow_tag = pipe.ass_color_no_alpha((0, 0, 0))
    tags = (
        f"{{\\bord{OUTLINE}\\shad{SHADOW}"
        f"\\3c{stroke_tag}\\4c{shadow_tag}}}"
    )

    header = f"""[Script Info]
Title: piloto-carta-sem-voz
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {WIDTH}
PlayResY: {HEIGHT}
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Punch,{font},{HOOK_FONT + 4},{pipe.rgb_to_ass(hook_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.5,0,1,{OUTLINE},{SHADOW},8,{MARGIN_LR},{MARGIN_LR},{HOOK_MARGIN_V},1
Style: Hook,{font},{HOOK_FONT},{pipe.rgb_to_ass(hook_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.6,0,1,{OUTLINE},{SHADOW},8,{MARGIN_LR},{MARGIN_LR},{HOOK_MARGIN_V},1
Style: CTA,{font},{CTA_FONT},{pipe.rgb_to_ass(cta_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.8,0,1,{OUTLINE},{SHADOW},2,{MARGIN_LR},{MARGIN_LR},{CTA_MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = [
        (
            f"Dialogue: 0,{pipe.ass_timestamp(0.05)},{pipe.ass_timestamp(punch_end)},"
            f"Punch,,0,0,0,,{tags}{punch_text}"
        ),
        (
            f"Dialogue: 0,{pipe.ass_timestamp(hook_full_start)},{pipe.ass_timestamp(hook_end)},"
            f"Hook,,0,0,0,,{tags}{hook_text}"
        ),
        (
            f"Dialogue: 1,{pipe.ass_timestamp(cta_start)},{pipe.ass_timestamp(duration)},"
            f"CTA,,0,0,0,,{tags}{cta_text}"
        ),
    ]
    path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def render_piloto(
    *,
    card_name: str,
    duration: float,
    out_path: Path,
) -> Path:
    card = CARDS_DIR / card_name
    if not card.is_file():
        raise SystemExit(f"Carta não encontrada: {card}")
    if not AUDIO_PATH.is_file():
        raise SystemExit(f"Trilha não encontrada: {AUDIO_PATH}")

    ffmpeg = pipe.find_ffmpeg()
    ffprobe = pipe.find_ffprobe()
    palette = pipe.extract_palette(card)
    print(
        f"carta={card.name}  duration={duration:.1f}s  "
        f"accent={palette['accent']} text={palette['text']}"
    )
    print(f"trilha={AUDIO_PATH.name}  vol={MUSIC_VOLUME}")
    print(f"saída={out_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    frames = max(int(round(duration * FPS)), FPS)
    zoom_end = 1.12
    zoom_expr = f"1+({zoom_end}-1)*on/{max(frames - 1, 1)}"
    fade_start = max(0.0, duration - FADE_OUT_SEC)

    with tempfile.TemporaryDirectory(prefix="piloto-tiktok-") as tmp:
        work = Path(tmp)
        ass_path = work / "piloto.ass"
        write_piloto_ass(
            ass_path,
            duration=duration,
            text_rgb=palette["text"],
            accent_rgb=palette["accent"],
        )
        ass_escaped = (
            str(ass_path.resolve()).replace("\\", "/").replace(":", "\\:")
        )
        vf = (
            f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,"
            f"crop={WIDTH}:{HEIGHT},"
            f"scale=8000:-1,"
            f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
            f"ass='{ass_escaped}'"
        )
        cmd = [
            ffmpeg,
            "-y",
            "-loop",
            "1",
            "-i",
            str(card),
            "-i",
            str(AUDIO_PATH),
            "-vf",
            vf,
            "-af",
            f"volume={MUSIC_VOLUME},afade=t=out:st={fade_start:.3f}:d={FADE_OUT_SEC}",
            "-t",
            f"{duration:.3f}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            sys.stderr.write(proc.stderr[-4000:] if proc.stderr else "ffmpeg failed\n")
            raise SystemExit(f"ffmpeg exit {proc.returncode}")

    if not out_path.is_file() or out_path.stat().st_size < 10_000:
        raise SystemExit(f"Saída inválida: {out_path}")
    real = pipe.probe_duration(ffprobe, out_path)
    print(f"OK {out_path}  ({out_path.stat().st_size / 1e6:.2f} MB, {real:.2f}s)")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Piloto TikTok sem voz (1 vídeo)")
    parser.add_argument(
        "--card",
        default="mago.jpg",
        help="Arquivo em public/images/archetypes (default: mago.jpg)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=14.0,
        help="Duração em segundos (8–20; default 14)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT_DIR / DEFAULT_OUT_NAME,
        help="Caminho do MP4 de saída",
    )
    args = parser.parse_args()
    dur = max(8.0, min(20.0, float(args.duration)))
    render_piloto(card_name=args.card, duration=dur, out_path=args.out.resolve())


if __name__ == "__main__":
    main()
