#!/usr/bin/env python3
"""
Gera 12 vídeos verticais TikTok (9:16) dos arquétipos do quiz medieval.

Uso:
  python scripts/generate-tiktok-archetype-videos.py
  python scripts/generate-tiktok-archetype-videos.py --only 01-inocente
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CARDS_DIR = REPO_ROOT / "public" / "images" / "archetypes"
AUDIO_PATH = REPO_ROOT / "public" / "audio" / "dark-and-darker-lobby.mp3"
DEFAULT_OUT = Path(r"C:\Users\Next\Desktop\projeto quiz medieval\editado")

WIDTH = 1080
HEIGHT = 1920
FPS = 30
AUDIO_VOLUME = 0.16  # ambiente — não estoura, não abafa legenda
FADE_OUT_SEC = 1.6
CHARS_PER_SEC = 13.5  # leitura de legenda em PT-BR
MIN_PHRASE_SEC = 1.35
MAX_PHRASE_SEC = 3.8
GAP_SEC = 0.12
LEAD_IN_SEC = 0.35
TAIL_HOLD_SEC = 0.55

# Ordem pedida: Inocente, Órfão, Herói, Cuidador, Explorador, Rebelde,
# Amante, Criador, Bobo da Corte, Sábio, Mago, Governante
ARCHETYPES = [
    {
        "slug": "01-inocente",
        "card": "inocente.jpg",
        "title": "O Inocente",
        "lines": [
            "Você sempre tenta ver o lado bom?",
            "Pode ser o arquétipo do Inocente.",
            "Desejo: paz, felicidade e simplicidade.",
            "Sua força: otimismo e fé genuína.",
            "Mas a sombra é real:",
            "ingenuidade… e negar o problema.",
            "Descubra seu arquétipo no quiz.",
            "Link na bio.",
        ],
    },
    {
        "slug": "02-orfao",
        "card": "pessoa_comum.jpg",
        "title": "O Órfão",
        "lines": [
            "Você se anula pra não ser excluído?",
            "Isso tem nome: arquétipo do Órfão.",
            "Desejo: pertencimento e igualdade.",
            "Força: empatia e pés no chão.",
            "A sombra cobra caro:",
            "apagar quem você é… só pra agradar.",
            "Faça o quiz e veja seu perfil.",
            "Link na bio.",
        ],
    },
    {
        "slug": "03-heroi",
        "card": "heroi.jpg",
        "title": "O Herói",
        "lines": [
            "Você precisa vencer… pra se sentir válido?",
            "Arquétipo do Herói.",
            "Desejo: provar valor com coragem.",
            "Força: determinação e superação.",
            "A sombra: arrogância…",
            "e exaustão por lutar demais.",
            "Qual é o seu arquétipo dominante?",
            "Quiz na bio.",
        ],
    },
    {
        "slug": "04-cuidador",
        "card": "cuidador.jpg",
        "title": "O Cuidador",
        "lines": [
            "Você cuida de todo mundo…",
            "e esquece de si?",
            "Arquétipo do Cuidador.",
            "Desejo: proteger e acolher.",
            "Força: generosidade e compaixão.",
            "Sombra: síndrome do mártir.",
            "Descubra se esse é o seu perfil.",
            "Quiz na bio.",
        ],
    },
    {
        "slug": "05-explorador",
        "card": "explorador.jpg",
        "title": "O Explorador",
        "lines": [
            "Rotina te sufoca?",
            "Você pode ser o Explorador.",
            "Desejo: liberdade pra descobrir o mundo.",
            "Força: autonomia e curiosidade.",
            "A sombra: fugir de compromissos…",
            "e nunca criar raízes.",
            "Teste seu arquétipo agora.",
            "Link na bio.",
        ],
    },
    {
        "slug": "06-rebelde",
        "card": "rebelde.jpg",
        "title": "O Rebelde",
        "lines": [
            "Regras te irritam no automático?",
            "Arquétipo do Rebelde.",
            "Desejo: revolução e autenticidade.",
            "Força: coragem pra quebrar o status quo.",
            "Sombra: cinismo…",
            "ou rebeldia sem propósito.",
            "Descubra o seu no quiz.",
            "Link na bio.",
        ],
    },
    {
        "slug": "07-amante",
        "card": "amante.jpg",
        "title": "O Amante",
        "lines": [
            "Você sente tudo… intenso demais?",
            "Arquétipo do Amante.",
            "Desejo: intimidade e paixão profunda.",
            "Força: entrega e senso estético.",
            "A sombra: dependência emocional…",
            "e medo da rejeição.",
            "Qual arquétipo te governa?",
            "Quiz na bio.",
        ],
    },
    {
        "slug": "08-criador",
        "card": "criador.jpg",
        "title": "O Criador",
        "lines": [
            "Medíocre te dá ânsia?",
            "Você pode ser o Criador.",
            "Desejo: criar algo original e duradouro.",
            "Força: imaginação e visão autoral.",
            "Sombra: perfeccionismo paralisante.",
            "Nunca termina… nunca solta.",
            "Faça o quiz medieval.",
            "Link na bio.",
        ],
    },
    {
        "slug": "09-bobo-da-corte",
        "card": "bobo_da_corte.jpg",
        "title": "O Bobo da Corte",
        "lines": [
            "Você desarma tudo com humor?",
            "Arquétipo do Bobo da Corte.",
            "Desejo: viver o presente com leveza.",
            "Força: carisma e espontaneidade.",
            "Sombra: fugir do sério…",
            "e parecer irresponsável.",
            "Descubra seu arquétipo.",
            "Quiz na bio.",
        ],
    },
    {
        "slug": "10-sabio",
        "card": "sabio.jpg",
        "title": "O Sábio",
        "lines": [
            "Você analisa… e analisa… e trava?",
            "Arquétipo do Sábio.",
            "Desejo: achar a verdade pela inteligência.",
            "Força: clareza e pensamento crítico.",
            "Sombra: paralisia por análise…",
            "e frieza emocional.",
            "Qual é o seu perfil?",
            "Link na bio.",
        ],
    },
    {
        "slug": "11-mago",
        "card": "mago.jpg",
        "title": "O Mago",
        "lines": [
            "Você transforma caos em solução?",
            "Arquétipo do Mago.",
            "Desejo: entender as leis do universo…",
            "e mudar o jogo.",
            "Força: visão e poder de transformação.",
            "Sombra: manipulação… ou desconexão prática.",
            "Teste agora no quiz.",
            "Link na bio.",
        ],
    },
    {
        "slug": "12-governante",
        "card": "governante.jpg",
        "title": "O Governante",
        "lines": [
            "Caos te tira do eixo?",
            "Arquétipo do Governante.",
            "Desejo: ordem, controle e prosperidade.",
            "Força: liderança e estrutura sólida.",
            "Sombra: controle excessivo…",
            "rigidez e micromanagement.",
            "Descubra seu arquétipo dominante.",
            "Quiz na bio.",
        ],
    },
]


def find_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path:
        return path
    raise SystemExit(
        "ffmpeg não encontrado no PATH. Instale (ex.: winget install Gyan.FFmpeg) e reabra o terminal."
    )


def find_ffprobe() -> str:
    path = shutil.which("ffprobe")
    if path:
        return path
    raise SystemExit("ffprobe não encontrado no PATH.")


def phrase_duration(text: str) -> float:
    chars = len(text.strip())
    sec = chars / CHARS_PER_SEC
    return max(MIN_PHRASE_SEC, min(MAX_PHRASE_SEC, sec))


def build_timeline(lines: list[str]) -> tuple[list[tuple[float, float, str]], float]:
    """Retorna (segments start/end/text, duração total). Sem sobreposição."""
    t = LEAD_IN_SEC
    segments: list[tuple[float, float, str]] = []
    for i, line in enumerate(lines):
        dur = phrase_duration(line)
        start = t
        end = t + dur
        segments.append((start, end, line))
        t = end + (GAP_SEC if i < len(lines) - 1 else 0)
    total = t + TAIL_HOLD_SEC
    return segments, total


def ass_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - math.floor(seconds)) * 100))
    if cs >= 100:
        s += 1
        cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def write_ass(path: Path, segments: list[tuple[float, float, str]], title: str) -> None:
    # Área segura central TikTok: margens laterais + vertical média
    # Alignment 5 = middle-center
    header = f"""[Script Info]
Title: {title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {WIDTH}
PlayResY: {HEIGHT}
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial Black,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,5,110,110,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for start, end, text in segments:
        safe = (
            text.replace("\\", "\\\\")
            .replace("{", "\\{")
            .replace("}", "\\}")
            .replace("\n", "\\N")
        )
        events.append(
            f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},Caption,,0,0,0,,{safe}"
        )
    path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def run(cmd: list[str]) -> None:
    print(">", " ".join(cmd[:8]), "..." if len(cmd) > 8 else "")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr[-4000:] if proc.stderr else "ffmpeg failed\n")
        raise SystemExit(f"Comando falhou ({proc.returncode}): {cmd[0]}")


def probe_duration(ffprobe: str, media: Path) -> float:
    out = subprocess.check_output(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(media),
        ],
        text=True,
    )
    data = json.loads(out)
    return float(data["format"]["duration"])


def generate_one(
    ffmpeg: str,
    ffprobe: str,
    arch: dict,
    out_dir: Path,
    work_dir: Path,
) -> Path:
    card = CARDS_DIR / arch["card"]
    if not card.exists():
        raise SystemExit(f"Carta não encontrada: {card}")

    segments, duration = build_timeline(arch["lines"])
    frames = max(int(round(duration * FPS)), FPS)
    # zoompan d=frames precisa de input maior; scale up para Ken Burns
    # zoom de ~1.0 → ~1.10 ao longo do vídeo
    zoom_end = 1.10
    zoom_expr = f"1+({zoom_end}-1)*on/{max(frames - 1, 1)}"

    ass_path = work_dir / f"{arch['slug']}.ass"
    write_ass(ass_path, segments, arch["title"])

    out_path = out_dir / f"{arch['slug']}.mp4"
    fade_start = max(0.0, duration - FADE_OUT_SEC)

    # Escape path for ASS filter on Windows (drive letter + backslashes)
    ass_escaped = (
        str(ass_path.resolve())
        .replace("\\", "/")
        .replace(":", "\\:")
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
        f"volume={AUDIO_VOLUME},afade=t=out:st={fade_start:.3f}:d={FADE_OUT_SEC}",
        "-t",
        f"{duration:.3f}",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        str(out_path),
    ]
    run(cmd)

    # Sanity: file exists and opens
    if not out_path.exists() or out_path.stat().st_size < 10_000:
        raise SystemExit(f"Saída inválida: {out_path}")
    probe_duration(ffprobe, out_path)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera vídeos TikTok dos 12 arquétipos")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Pasta de saída dos MP4",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        help="Gerar apenas estes slugs (ex.: 01-inocente 12-governante)",
    )
    args = parser.parse_args()

    if not CARDS_DIR.is_dir():
        raise SystemExit(f"Pasta de cartas não encontrada: {CARDS_DIR}")
    if not AUDIO_PATH.is_file():
        raise SystemExit(f"Trilha não encontrada: {AUDIO_PATH}")

    ffmpeg = find_ffmpeg()
    ffprobe = find_ffprobe()
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    selected = ARCHETYPES
    if args.only:
        wanted = set(args.only)
        selected = [a for a in ARCHETYPES if a["slug"] in wanted]
        missing = wanted - {a["slug"] for a in selected}
        if missing:
            raise SystemExit(f"Slugs desconhecidos: {sorted(missing)}")

    print(f"Cartas: {CARDS_DIR}")
    print(f"Trilha: {AUDIO_PATH}")
    print(f"Saída:  {out_dir}")
    print(f"ffmpeg: {ffmpeg}")

    results = []
    with tempfile.TemporaryDirectory(prefix="tiktok-archetypes-") as tmp:
        work = Path(tmp)
        for arch in selected:
            print(f"\n=== {arch['slug']} ({arch['title']}) ===")
            path = generate_one(ffmpeg, ffprobe, arch, out_dir, work)
            dur = probe_duration(ffprobe, path)
            size = path.stat().st_size
            results.append((path, size, dur))
            print(f"OK {path.name}  {size/1_000_000:.2f} MB  {dur:.1f}s")

    # Verificação final: os 12 (ou subset) existem e abrem
    print("\n--- Verificação ---")
    expected = [a["slug"] for a in (selected if args.only else ARCHETYPES)]
    errors = []
    for slug in expected:
        mp4 = out_dir / f"{slug}.mp4"
        if not mp4.exists():
            errors.append(f"faltando: {mp4}")
            continue
        try:
            d = probe_duration(ffprobe, mp4)
            print(f"OK {mp4.name}\t{mp4.stat().st_size:>10} bytes\t{d:.2f}s")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"não abre: {mp4} ({exc})")

    if errors:
        raise SystemExit("\n".join(errors))

    if not args.only and len(expected) != 12:
        raise SystemExit("Esperava 12 arquétipos")

    print(f"\nConcluído: {len(expected)} vídeo(s) em {out_dir}")


if __name__ == "__main__":
    main()
