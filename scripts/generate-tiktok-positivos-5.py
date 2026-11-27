#!/usr/bin/env python3
"""
Gera 5 vídeos TikTok curtos (9:16) — carta + música, SEM voz / SEM TTS.

Fluxo: forças (identificação) → revela nome do arquétipo → CTA quiz.
Legenda no topo; CTA na base. Nesta série o nome PODE aparecer.

Uso:
  python scripts/generate-tiktok-positivos-5.py
  python scripts/generate-tiktok-positivos-5.py --only 1,3
  python scripts/generate-tiktok-positivos-5.py --dry-run
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

_PIPE_PATH = SCRIPT_DIR / "generate-tiktok-archetype-videos.py"
_spec = importlib.util.spec_from_file_location("tiktok_pipe", _PIPE_PATH)
if _spec is None or _spec.loader is None:
    raise SystemExit(f"Não carreguei {_PIPE_PATH}")
pipe = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pipe)

CARDS_DIR = REPO_ROOT / "public" / "images" / "archetypes"
AUDIO_PATH = REPO_ROOT / "public" / "audio" / "dark-and-darker-lobby.mp3"
DEFAULT_ROTEIROS = REPO_ROOT / "ROTEIROS_POSITIVOS_5.md"
DEFAULT_OUT_DIR = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\videos-positivos-5"
)
TEMP_ROOT = Path(r"D:\tiktok-temp")

CTA_SCREEN = (
    "Se você se identificou\n"
    "mesmo um pouco —\n"
    "faça o teste completo\n"
    "e confirme o arquétipo\n"
    "link da bio"
)
CTA_PHRASE = (
    "Se você se identificou mesmo um pouco — "
    "faça o teste completo e confirme o arquétipo"
)

# Nomes oficiais do quiz (title sem o artigo, para “do Herói”)
SLUG_TITLE: dict[str, str] = {
    "heroi": "Herói",
    "cuidador": "Cuidador",
    "criador": "Criador",
    "sabio": "Sábio",
    "explorador": "Explorador",
    "inocente": "Inocente",
    "rebelde": "Rebelde",
    "mago": "Mago",
    "pessoa_comum": "Órfão",
    "amante": "Amante",
    "bobo_da_corte": "Bobo da Corte",
    "governante": "Governante",
}

WIDTH = pipe.WIDTH
HEIGHT = pipe.HEIGHT
FPS = pipe.FPS
MUSIC_VOLUME = 0.14
FADE_OUT_SEC = 1.4
DEFAULT_DURATION = 14.0

HOOK_FONT = 48
REVEAL_FONT = 50
CTA_FONT = 36
HOOK_MARGIN_V = 165  # Alignment 8 — topo
REVEAL_MARGIN_V = 165
CTA_MARGIN_V = 280
MARGIN_LR = 96
OUTLINE = 2.3
SHADOW = 2.5
PUNCH_END_SEC = 1.85

# Fallback estático se o MD falhar no parse
STATIC_SPECS: list[dict[str, object]] = [
    {
        "index": 1,
        "card": "heroi.jpg",
        "slug": "heroi",
        "punch": "Você segura a linha quando outros param.",
        "lines": (
            "Você segura a linha quando outros param.",
            "Disciplina. Foco. Coragem prática.",
            "Isso é a sua marca.",
        ),
        "reveal": "Isso é o arquétipo do Herói.",
    },
    {
        "index": 2,
        "card": "cuidador.jpg",
        "slug": "cuidador",
        "punch": "Você vê quem precisa — e chega.",
        "lines": (
            "Você vê quem precisa — e chega.",
            "Generosidade sem teatro.",
            "Paciência que acolhe de verdade.",
        ),
        "reveal": "Isso é o arquétipo do Cuidador.",
    },
    {
        "index": 3,
        "card": "criador.jpg",
        "slug": "criador",
        "punch": "Você enxerga o que ainda não existe.",
        "lines": (
            "Você enxerga o que ainda não existe.",
            "Imaginação + originalidade.",
            "Beleza com assinatura sua.",
        ),
        "reveal": "Isso é o arquétipo do Criador.",
    },
    {
        "index": 4,
        "card": "sabio.jpg",
        "slug": "sabio",
        "punch": "Você corta o ruído e acha o essencial.",
        "lines": (
            "Você corta o ruído e acha o essencial.",
            "Clareza. Objetividade.",
            "Pensamento que ilumina.",
        ),
        "reveal": "Isso é o arquétipo do Sábio.",
    },
    {
        "index": 5,
        "card": "explorador.jpg",
        "slug": "explorador",
        "punch": "Você abre caminho onde outros repetem.",
        "lines": (
            "Você abre caminho onde outros repetem.",
            "Curiosidade viva.",
            "Liberdade com adaptação rápida.",
        ),
        "reveal": "Isso é o arquétipo do Explorador.",
    },
]


@dataclass
class PositivoSpec:
    index: int
    card: str
    slug: str
    punch: str
    lines: tuple[str, ...]
    reveal: str
    cta: str
    out_name: str

    @property
    def label(self) -> str:
        return f"positiva-{self.index:02d}-{self.slug}"


def ass_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )


def default_reveal(slug: str) -> str:
    title = SLUG_TITLE.get(slug, slug.replace("_", " ").title())
    return f"Isso é o arquétipo do {title}."


def parse_roteiros(path: Path) -> list[PositivoSpec]:
    if not path.is_file():
        return specs_from_static()

    text = path.read_text(encoding="utf-8")
    section_re = re.compile(
        r"## (\d+)\.\s*Carta / Arquétipo \(ref\. interna\):\s*([^·]+)·\s*`([a-z0-9_]+\.jpg)`\s*\n(.*?)(?=\n## \d+\. |\n## Checklist|\Z)",
        re.DOTALL | re.IGNORECASE,
    )
    specs: list[PositivoSpec] = []
    for m in section_re.finditer(text):
        index = int(m.group(1))
        slug_from_card = m.group(3).lower().replace(".jpg", "")
        body = m.group(4)

        punch_m = re.search(r"-\s*\*\*Punch:\*\*\s*`([^`]+)`", body)
        forcas_m = re.search(r"-\s*\*\*Forças:\*\*\s*(.+)", body)
        if not punch_m or not forcas_m:
            raise SystemExit(f"Punch/Forças ausentes no vídeo {index}")
        punch = punch_m.group(1).strip()
        forcas_raw = forcas_m.group(1).strip()
        lines = tuple(p.strip() for p in forcas_raw.split("/") if p.strip())
        if len(lines) < 2:
            raise SystemExit(f"Forças curtas demais no vídeo {index}")

        reveal_m = re.search(r"-\s*\*\*Revelação:\*\*\s*`([^`]+)`", body)
        reveal = (
            reveal_m.group(1).strip()
            if reveal_m
            else default_reveal(slug_from_card)
        )

        cta_m = re.search(r"-\s*\*\*CTA:\*\*\s*(.+)", body)
        cta_raw = cta_m.group(1).strip() if cta_m else CTA_PHRASE
        if "teste completo" not in cta_raw.lower() and "link da bio" not in cta_raw.lower():
            raise SystemExit(f"CTA fora do padrão no vídeo {index}: {cta_raw[:80]}")

        specs.append(
            PositivoSpec(
                index=index,
                card=m.group(3).lower(),
                slug=slug_from_card,
                punch=punch,
                lines=lines,
                reveal=reveal,
                cta=CTA_SCREEN,
                out_name=f"carta-positiva-{index:02d}-{slug_from_card}.mp4",
            )
        )

    if len(specs) != 5:
        print(
            f"Aviso: parse MD achou {len(specs)} seções; usando fallback estático.",
            file=sys.stderr,
        )
        return specs_from_static()
    specs.sort(key=lambda s: s.index)
    return specs


def specs_from_static() -> list[PositivoSpec]:
    out: list[PositivoSpec] = []
    for raw in STATIC_SPECS:
        idx = int(raw["index"])
        slug = str(raw["slug"])
        punch = str(raw["punch"])
        lines = tuple(str(x) for x in raw["lines"])  # type: ignore[arg-type]
        reveal = str(raw.get("reveal") or default_reveal(slug))
        out.append(
            PositivoSpec(
                index=idx,
                card=str(raw["card"]),
                slug=slug,
                punch=punch,
                lines=lines,
                reveal=reveal,
                cta=CTA_SCREEN,
                out_name=f"carta-positiva-{idx:02d}-{slug}.mp4",
            )
        )
    return out


def write_positivo_ass(
    path: Path,
    *,
    spec: PositivoSpec,
    duration: float,
    text_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
) -> None:
    """Forças no TOPO → revelação no TOPO → CTA na base."""
    font = pipe.pick_ass_font()
    stroke = pipe.rgb_to_ass((10, 8, 6), alpha=0)
    shadow = pipe.rgb_to_ass((0, 0, 0), alpha=0x55)
    hook_fill = pipe.lighten_for_text(text_rgb, min_v=0.93)
    reveal_fill = pipe.lighten_for_text(accent_rgb, min_v=0.94)
    if pipe.contrast_ratio(reveal_fill, (18, 16, 14)) < 3.0:
        reveal_fill = pipe.lighten_for_text(accent_rgb, min_v=0.97)
    cta_fill = pipe.lighten_for_text(accent_rgb, min_v=0.88)
    if pipe.contrast_ratio(cta_fill, (18, 16, 14)) < 3.0:
        cta_fill = pipe.lighten_for_text(accent_rgb, min_v=0.94)

    punch_text = ass_escape(spec.punch)
    hook_text = ass_escape("\n".join(spec.lines))
    reveal_text = ass_escape(spec.reveal)
    cta_text = ass_escape(spec.cta)

    # Timing: forças → revelação → CTA (curto)
    punch_end = min(PUNCH_END_SEC, duration * 0.14)
    forcas_end = min(7.0, duration * 0.50)
    reveal_start = forcas_end
    reveal_end = min(10.2, duration * 0.74)
    cta_start = min(9.5, duration * 0.68)

    stroke_tag = pipe.ass_color_no_alpha((10, 8, 6))
    shadow_tag = pipe.ass_color_no_alpha((0, 0, 0))
    tags = (
        f"{{\\bord{OUTLINE}\\shad{SHADOW}"
        f"\\3c{stroke_tag}\\4c{shadow_tag}}}"
    )

    header = f"""[Script Info]
Title: {spec.label}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {WIDTH}
PlayResY: {HEIGHT}
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Punch,{font},{HOOK_FONT + 4},{pipe.rgb_to_ass(hook_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.5,0,1,{OUTLINE},{SHADOW},8,{MARGIN_LR},{MARGIN_LR},{HOOK_MARGIN_V},1
Style: Hook,{font},{HOOK_FONT},{pipe.rgb_to_ass(hook_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.55,0,1,{OUTLINE},{SHADOW},8,{MARGIN_LR},{MARGIN_LR},{HOOK_MARGIN_V},1
Style: Reveal,{font},{REVEAL_FONT},{pipe.rgb_to_ass(reveal_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.6,0,1,{OUTLINE},{SHADOW},8,{MARGIN_LR},{MARGIN_LR},{REVEAL_MARGIN_V},1
Style: CTA,{font},{CTA_FONT},{pipe.rgb_to_ass(cta_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.7,0,1,{OUTLINE},{SHADOW},2,{MARGIN_LR},{MARGIN_LR},{CTA_MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = [
        (
            f"Dialogue: 0,{pipe.ass_timestamp(0.05)},{pipe.ass_timestamp(punch_end)},"
            f"Punch,,0,0,0,,{tags}{punch_text}"
        ),
        (
            f"Dialogue: 0,{pipe.ass_timestamp(punch_end)},{pipe.ass_timestamp(forcas_end)},"
            f"Hook,,0,0,0,,{tags}{hook_text}"
        ),
        (
            f"Dialogue: 0,{pipe.ass_timestamp(reveal_start)},{pipe.ass_timestamp(reveal_end)},"
            f"Reveal,,0,0,0,,{tags}{reveal_text}"
        ),
        (
            f"Dialogue: 1,{pipe.ass_timestamp(cta_start)},{pipe.ass_timestamp(duration)},"
            f"CTA,,0,0,0,,{tags}{cta_text}"
        ),
    ]
    path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def render_one(
    *,
    spec: PositivoSpec,
    duration: float,
    out_path: Path,
    work_root: Path,
) -> Path:
    card = CARDS_DIR / spec.card
    if not card.is_file():
        raise SystemExit(f"Carta não encontrada: {card}")
    if not AUDIO_PATH.is_file():
        raise SystemExit(f"Trilha não encontrada: {AUDIO_PATH}")

    ffmpeg = pipe.find_ffmpeg()
    ffprobe = pipe.find_ffprobe()
    palette = pipe.extract_palette(card)
    print(
        f"[{spec.index}/5] {spec.label}  card={spec.card}  "
        f"reveal={spec.reveal!r}  → {out_path.name}"
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    frames = max(int(round(duration * FPS)), FPS)
    zoom_end = 1.12
    zoom_expr = f"1+({zoom_end}-1)*on/{max(frames - 1, 1)}"
    fade_start = max(0.0, duration - FADE_OUT_SEC)

    work = work_root / spec.label
    work.mkdir(parents=True, exist_ok=True)
    ass_path = work / f"{spec.label}.ass"
    write_positivo_ass(
        ass_path,
        spec=spec,
        duration=duration,
        text_rgb=palette["text"],
        accent_rgb=palette["accent"],
    )
    ass_escaped = str(ass_path.resolve()).replace("\\", "/").replace(":", "\\:")
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
        raise SystemExit(f"ffmpeg exit {proc.returncode} em {spec.label}")

    if not out_path.is_file() or out_path.stat().st_size < 10_000:
        raise SystemExit(f"Saída inválida: {out_path}")
    real = pipe.probe_duration(ffprobe, out_path)
    print(f"  OK {out_path.stat().st_size / 1e6:.2f} MB  {real:.2f}s")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch 5 TikTok positivos (forças → revelação → CTA)"
    )
    parser.add_argument(
        "--roteiros",
        type=Path,
        default=DEFAULT_ROTEIROS,
        help="Markdown de roteiros positivos",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Pasta de saída MP4",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=DEFAULT_DURATION,
        help="Duração em segundos (8–15; default 14)",
    )
    parser.add_argument(
        "--only",
        default="",
        help="Índices 1–5 separados por vírgula (ex: 1,3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Só lista specs, não renderiza",
    )
    args = parser.parse_args()

    dur = max(8.0, min(15.0, float(args.duration)))
    specs = parse_roteiros(args.roteiros.resolve())
    if args.only.strip():
        wanted = {int(x.strip()) for x in args.only.split(",") if x.strip()}
        specs = [s for s in specs if s.index in wanted]
        if not specs:
            raise SystemExit(f"--only sem match: {args.only}")

    out_dir = args.out_dir.resolve()
    if out_dir.name.lower() == "videos-carta-musica-30":
        raise SystemExit("Recusado: out-dir não pode ser videos-carta-musica-30")

    print(f"roteiros={args.roteiros}")
    print(f"out={out_dir}  duration={dur:.1f}s  n={len(specs)}")
    print(f"trilha={AUDIO_PATH.name}  vol={MUSIC_VOLUME}  TTS=off  reveal=ON")

    if args.dry_run:
        for s in specs:
            print(f"  {s.index}. {s.out_name}  card={s.card}")
            print(f"     punch: {s.punch}")
            print(f"     lines: {' / '.join(s.lines)}")
            print(f"     reveal: {s.reveal}")
            print(f"     cta: {CTA_PHRASE} · link da bio")
        return

    TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    work_root = TEMP_ROOT / "positivos-5"
    work_root.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    editado = out_dir.parent
    dest_md = editado / "ROTEIROS_POSITIVOS_5.md"
    src_md = args.roteiros.resolve()
    if src_md.is_file():
        dest_md.write_text(src_md.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"roteiros→ {dest_md}")

    done: list[Path] = []
    for spec in specs:
        out_path = out_dir / spec.out_name
        done.append(
            render_one(
                spec=spec,
                duration=dur,
                out_path=out_path,
                work_root=work_root,
            )
        )

    print(f"\nPronto: {len(done)} vídeos em {out_dir}")
    for p in done:
        print(f"  - {p}")


if __name__ == "__main__":
    main()
