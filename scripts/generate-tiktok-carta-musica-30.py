#!/usr/bin/env python3
"""
Gera 30 vídeos TikTok (9:16) — carta + música, SEM voz / SEM TTS.

Formato (piloto aprovado):
- Carta do arquétipo do roteiro + Ken Burns
- Trilha: public/audio/dark-and-darker-lobby.mp3
- Texto na tela: gancho + blocos densos (ferida → custo → virada → CTA)
- Overlay discreto (topo / terço inferior), margens TikTok
- Nunca revela nome do arquétipo na tela
- Não toca InfinitePay / bloqueio

Uso:
  python scripts/generate-tiktok-carta-musica-30.py
  python scripts/generate-tiktok-carta-musica-30.py --only 1,2,3
  python scripts/generate-tiktok-carta-musica-30.py --dry-run
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import re
import subprocess
import sys
import tempfile
import textwrap
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
DEFAULT_ROTEIROS = REPO_ROOT / "ROTEIROS_FERIDA_CARTAS.md"
DEFAULT_OUT_DIR = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\videos-carta-musica-30"
)
TEMP_ROOT = Path(r"D:\tiktok-temp")
# CTA fixo (tela) — frase completa do brief ferida
CTA_SCREEN = (
    "Descubra se você tira\n"
    "essa carta no quiz\n"
    "link da bio"
)
CTA_PHRASE = "Descubra se você tira essa carta no quiz link da bio"

WIDTH = pipe.WIDTH
HEIGHT = pipe.HEIGHT
FPS = pipe.FPS
MUSIC_VOLUME = 0.14
FADE_OUT_SEC = 1.4

# Overlay (piloto): gancho no topo, blocos no terço inferior, CTA na base
# Texto discreto — não tapa a carta (margens TikTok + fonte menor no body)
HOOK_FONT = 48
BODY_FONT = 36
CTA_FONT = 40
HOOK_MARGIN_V = 165  # Alignment 8 (topo)
BODY_MARGIN_V = 580  # Alignment 2 — acima do CTA
CTA_MARGIN_V = 270
MARGIN_LR = 100
OUTLINE = 2.2
SHADOW = 2.4
PUNCH_END_SEC = 2.0
WRAP_WIDTH = 28

# Fallback quando a seção não traz `arquivo.jpg` explícito
CARD_FALLBACK: dict[tuple[int, int], str] = {
    (6, 3): "rebelde.jpg",  # Rebelde × Governante · tensão selo/trono
}

# Nomes / rótulos que NÃO podem aparecer na tela
FORBIDDEN_NAME_RE = re.compile(
    r"\b("
    r"Inocente|Órfão|Orfao|Herói|Heroi|Cuidador|Explorador|Rebelde|"
    r"Amante|Criador|Bobo(?:\s+da\s+Corte)?|Sábio|Sabio|Mago|Governante|"
    r"pessoa_comum|bobo_da_corte"
    r")\b",
    re.IGNORECASE,
)


@dataclass
class VideoSpec:
    index: int  # 1..30
    day: int
    video: int
    slot: str
    card: str
    punch: str
    ferida: str
    custo: str
    virada: str
    cta: str
    out_name: str

    @property
    def label(self) -> str:
        return f"Dia{self.day:02d}-Video{self.video}"


def ass_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )


def wrap_block(text: str, width: int = WRAP_WIDTH, max_lines: int = 5) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return ""
    lines = textwrap.wrap(
        cleaned,
        width=width,
        break_long_words=False,
        break_on_hyphens=False,
    )
    if len(lines) > max_lines:
        # Junta o excesso na última linha permitida (corta com reticências)
        head = lines[: max_lines - 1]
        tail = " ".join(lines[max_lines - 1 :])
        if len(tail) > width + 8:
            tail = tail[: width + 5].rstrip() + "…"
        lines = head + [tail]
    return "\n".join(lines)


def split_custo(text: str) -> list[str]:
    """Parte o custo em 1–2 blocos legíveis na tela."""
    cleaned = re.sub(r"\s+", " ", text.strip())
    words = cleaned.split()
    if len(words) <= 28:
        return [wrap_block(cleaned, max_lines=4)]
    mid = len(words) // 2
    # Preferir corte após pontuação perto do meio
    best = mid
    for i in range(mid - 8, mid + 9):
        if 0 < i < len(words) and words[i - 1].endswith((".", "…", ";", ":")):
            best = i
            break
    a = wrap_block(" ".join(words[:best]), max_lines=4)
    b = wrap_block(" ".join(words[best:]), max_lines=4)
    return [x for x in (a, b) if x]


def estimate_duration(spec: VideoSpec) -> float:
    """~25–45s conforme densidade do roteiro (sem voz)."""
    body = " ".join([spec.ferida, spec.custo, spec.virada])
    words = len(body.split())
    # Blocos ciclam ~6–8s cada; mais palavras → mais tempo de leitura
    n_custo = 2 if len(body.split()) > 55 else 1
    blocks = 2 + n_custo  # ferida + custo(+?) + virada
    dur = 12.0 + blocks * 6.2 + words / 9.0
    return max(25.0, min(45.0, round(dur, 1)))


def parse_roteiros(path: Path) -> list[VideoSpec]:
    text = path.read_text(encoding="utf-8")
    # Corta checklist / tabela final
    cut = text.find("## Distribuição interna")
    if cut != -1:
        text = text[:cut]

    section_re = re.compile(
        r"## Dia (\d+)\s*[—\-]\s*Vídeo (\d+)\s*\(([^)]+)\)\s*\n(.*?)(?=\n## Dia |\Z)",
        re.DOTALL | re.IGNORECASE,
    )
    specs: list[VideoSpec] = []
    for m in section_re.finditer(text):
        day = int(m.group(1))
        video = int(m.group(2))
        slot = m.group(3).strip()
        body = m.group(4)

        card_m = re.search(r"`([a-z0-9_]+\.jpg)`", body, re.IGNORECASE)
        if card_m:
            card = card_m.group(1).lower()
        else:
            card = CARD_FALLBACK.get((day, video))
            if not card:
                raise SystemExit(f"Sem carta mapeada: Dia {day} Vídeo {video}")

        punch_m = re.search(r"-\s*Tela:\s*`([^`]+)`", body)
        if not punch_m:
            raise SystemExit(f"Sem gancho de tela: Dia {day} Vídeo {video}")
        punch = punch_m.group(1).strip()

        def _section(label_prefix: str) -> str:
            # Labels: Ferida | Custo invisível | Virada da carta
            pat = re.compile(
                rf"\*\*\[[^\]]*·\s*{label_prefix}[^\]]*\]\*\*\s*(.+?)"
                rf"(?=\n\*\*\[[^\]]*·|\n\*\*CTA:\*\*|\Z)",
                re.DOTALL | re.IGNORECASE,
            )
            sm = pat.search(body)
            if not sm:
                raise SystemExit(
                    f"Sem bloco {label_prefix}: Dia {day} Vídeo {video}"
                )
            return re.sub(r"\s+", " ", sm.group(1)).strip()

        ferida = _section("Ferida")
        custo = _section("Custo")
        virada = _section("Virada")

        cta_m = re.search(r"\*\*CTA:\*\*\s*(.+)", body)
        if not cta_m:
            raise SystemExit(f"Sem CTA: Dia {day} Vídeo {video}")
        cta_raw = cta_m.group(1).strip()
        # Exige a frase completa do brief (aceita variação mínima de pontuação)
        if "Descubra se você tira essa carta no quiz link da bio" not in cta_raw:
            raise SystemExit(
                f"CTA fora do padrão ferida: Dia {day} Vídeo {video}: {cta_raw[:80]}"
            )
        cta = CTA_SCREEN

        index = (day - 1) * 3 + video
        out_name = f"Dia{day:02d}-Video{video}.mp4"
        spec = VideoSpec(
            index=index,
            day=day,
            video=video,
            slot=slot,
            card=card,
            punch=punch,
            ferida=ferida,
            custo=custo,
            virada=virada,
            cta=cta,
            out_name=out_name,
        )
        # Checagem de nomes proibidos (texto público)
        for field, val in (
            ("punch", punch),
            ("ferida", ferida),
            ("custo", custo),
            ("virada", virada),
            ("cta", cta_raw),
        ):
            if FORBIDDEN_NAME_RE.search(val):
                raise SystemExit(
                    f"Nome de arquétipo vazou em {spec.label}.{field}: {val[:80]}"
                )
        specs.append(spec)

    if len(specs) != 30:
        raise SystemExit(f"Esperava 30 seções, achei {len(specs)} em {path}")
    specs.sort(key=lambda s: (s.day, s.video))
    return specs


def write_video_ass(
    path: Path,
    *,
    spec: VideoSpec,
    duration: float,
    text_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
) -> None:
    font = pipe.pick_ass_font()
    stroke = pipe.rgb_to_ass((10, 8, 6), alpha=0)
    shadow = pipe.rgb_to_ass((0, 0, 0), alpha=0x55)
    hook_fill = pipe.lighten_for_text(text_rgb, min_v=0.93)
    body_fill = pipe.lighten_for_text(text_rgb, min_v=0.90)
    cta_fill = pipe.lighten_for_text(accent_rgb, min_v=0.88)
    if pipe.contrast_ratio(cta_fill, (18, 16, 14)) < 3.0:
        cta_fill = pipe.lighten_for_text(accent_rgb, min_v=0.94)

    punch_text = ass_escape(wrap_block(spec.punch, width=26, max_lines=3))
    ferida_text = ass_escape(wrap_block(spec.ferida, max_lines=4))
    custo_parts = split_custo(spec.custo)
    virada_text = ass_escape(wrap_block(spec.virada, max_lines=4))
    cta_text = ass_escape(spec.cta)

    punch_end = min(PUNCH_END_SEC, duration * 0.08)
    hook_end = max(duration - 0.4, duration * 0.92)
    # Blocos densos começam após o punch; CTA entra no terço inicial e fica
    t0 = punch_end
    t_cta = min(5.5, duration * 0.2)
    content_end = max(duration - 1.0, duration * 0.9)
    usable = max(content_end - t0, 8.0)

    weights = [1.0] + [1.15] * len(custo_parts) + [1.05]
    total_w = sum(weights)
    spans = [usable * (w / total_w) for w in weights]

    cursor = t0
    windows: list[tuple[float, float, str, str]] = []
    # Gancho no topo o vídeo inteiro (punch maior nos 2s; depois mesmo texto)
    windows.append((0.05, punch_end, "Punch", punch_text))
    windows.append((punch_end, hook_end, "Hook", punch_text))

    ferida_end = cursor + spans[0]
    windows.append((cursor, ferida_end, "Body", ferida_text))
    cursor = ferida_end

    for i, part in enumerate(custo_parts):
        end = cursor + spans[1 + i]
        windows.append((cursor, end, "Body", ass_escape(part)))
        cursor = end

    windows.append((cursor, content_end, "Body", virada_text))
    windows.append((t_cta, duration, "CTA", cta_text))

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
Style: Body,{font},{BODY_FONT},{pipe.rgb_to_ass(body_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.4,0,1,{OUTLINE},{SHADOW},2,{MARGIN_LR},{MARGIN_LR},{BODY_MARGIN_V},1
Style: CTA,{font},{CTA_FONT},{pipe.rgb_to_ass(cta_fill)},{pipe.rgb_to_ass(accent_rgb)},{stroke},{shadow},-1,0,0,0,100,100,0.75,0,1,{OUTLINE},{SHADOW},2,{MARGIN_LR},{MARGIN_LR},{CTA_MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    for start, end, style, txt in windows:
        layer = 1 if style == "CTA" else 0
        # Body e CTA compartilham base: sobe o body um pouco quando CTA está ativo
        # via MarginV diferente nos styles (Body mais alto / CTA mais baixo).
        events.append(
            f"Dialogue: {layer},{pipe.ass_timestamp(start)},{pipe.ass_timestamp(end)},"
            f"{style},,0,0,0,,{tags}{txt}"
        )
    path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def render_one(
    *,
    spec: VideoSpec,
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

    out_path.parent.mkdir(parents=True, exist_ok=True)
    frames = max(int(round(duration * FPS)), FPS)
    zoom_end = 1.12
    zoom_expr = f"1+({zoom_end}-1)*on/{max(frames - 1, 1)}"
    fade_start = max(0.0, duration - FADE_OUT_SEC)

    work = work_root / spec.label
    work.mkdir(parents=True, exist_ok=True)
    ass_path = work / f"{spec.label}.ass"
    write_video_ass(
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
    print(
        f"OK {spec.label}  card={spec.card}  "
        f"{out_path.stat().st_size / 1e6:.2f} MB  {real:.2f}s"
    )
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch 30 TikTok carta+música (sem voz)"
    )
    parser.add_argument(
        "--roteiros",
        type=Path,
        default=DEFAULT_ROTEIROS,
        help="Markdown dos 30 roteiros profundos",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Pasta de saída dos MP4",
    )
    parser.add_argument(
        "--only",
        type=str,
        default="",
        help="Índices 1–30 separados por vírgula (ex: 1,2,3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Só lista mapeamento dia→carta→duração",
    )
    parser.add_argument(
        "--temp-root",
        type=Path,
        default=TEMP_ROOT,
        help="Temp em D: se C: encher",
    )
    args = parser.parse_args()

    roteiros = args.roteiros.resolve()
    if not roteiros.is_file():
        raise SystemExit(f"Roteiros não encontrados: {roteiros}")

    specs = parse_roteiros(roteiros)
    if args.only.strip():
        wanted = {int(x.strip()) for x in args.only.split(",") if x.strip()}
        specs = [s for s in specs if s.index in wanted]
        if not specs:
            raise SystemExit("Nenhum índice válido em --only")

    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    temp_root = args.temp_root.resolve()
    temp_root.mkdir(parents=True, exist_ok=True)

    # Preferir TEMP em D:
    os.environ["TEMP"] = str(temp_root)
    os.environ["TMP"] = str(temp_root)
    tempfile.tempdir = str(temp_root)

    print(f"roteiros={roteiros}")
    print(f"out={out_dir}")
    print(f"temp={temp_root}")
    print(f"audio={AUDIO_PATH.name}  vol={MUSIC_VOLUME}")
    print(f"vídeos={len(specs)}")

    plan: list[tuple[VideoSpec, float]] = []
    for spec in specs:
        dur = estimate_duration(spec)
        plan.append((spec, dur))
        print(
            f"  [{spec.index:02d}] {spec.label}  {spec.card:<22}  "
            f"{dur:4.1f}s  punch={spec.punch[:40]}"
        )

    if args.dry_run:
        print("dry-run OK")
        return

    work_root = temp_root / "carta-musica-30"
    if work_root.exists():
        # limpa ASS antigos deste batch
        for p in work_root.glob("*"):
            if p.is_file():
                p.unlink()
            elif p.is_dir():
                for f in p.rglob("*"):
                    if f.is_file():
                        f.unlink()
    work_root.mkdir(parents=True, exist_ok=True)

    ok = 0
    for spec, dur in plan:
        out_path = out_dir / spec.out_name
        print(f"\n=== [{spec.index}/30] {spec.label} → {out_path.name} ===")
        render_one(
            spec=spec,
            duration=dur,
            out_path=out_path,
            work_root=work_root,
        )
        ok += 1

    print(f"\nDONE {ok}/{len(plan)} em {out_dir}")
    missing = [
        f"Dia{d:02d}-Video{v}.mp4"
        for d in range(1, 11)
        for v in range(1, 4)
        if not (out_dir / f"Dia{d:02d}-Video{v}.mp4").is_file()
    ]
    if missing and not args.only:
        print("FALTANDO:", ", ".join(missing))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
