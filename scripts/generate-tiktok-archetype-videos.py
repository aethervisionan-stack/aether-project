#!/usr/bin/env python3
"""
Gera 12 vídeos verticais TikTok (9:16) dos arquétipos do quiz medieval.

Extrai paleta dominante de cada carta (ColorThief + quantização Pillow),
aplica cor principal no texto e secundária em keywords; se contraste baixo,
usa backdrop escuro + stroke + sombra.

Uso:
  python scripts/generate-tiktok-archetype-videos.py
  python scripts/generate-tiktok-archetype-videos.py --only 01-inocente
"""

from __future__ import annotations

import argparse
import colorsys
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
from colorthief import ColorThief

KNOWN_FFMPEG_DIRS = [
    Path(r"C:\Users\Next\AppData\Local\Microsoft\WinGet\Packages")
    / "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "ffmpeg-9.1-full_build"
    / "bin",
]


def resolve_repo_root() -> Path:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[1],  # .../aether-project/scripts → repo
        Path(r"C:\Users\Next\aether-project"),
    ]
    for cand in candidates:
        if (cand / "public" / "images" / "archetypes").is_dir():
            return cand
    raise SystemExit(
        "Não achei public/images/archetypes. Rode a partir do aether-project "
        "ou ajuste REPO_ROOT."
    )


REPO_ROOT = resolve_repo_root()
CARDS_DIR = REPO_ROOT / "public" / "images" / "archetypes"
AUDIO_PATH = REPO_ROOT / "public" / "audio" / "dark-and-darker-lobby.mp3"
DEFAULT_OUT = Path(r"C:\Users\Next\Desktop\projeto quiz medieval\editado")

WIDTH = 1080
HEIGHT = 1920
FPS = 30
AUDIO_VOLUME = 0.16
FADE_OUT_SEC = 1.6
CHARS_PER_SEC = 13.0
MIN_PHRASE_SEC = 1.25
MAX_PHRASE_SEC = 4.2
GAP_SEC = 0.10
LEAD_IN_SEC = 0.30
TAIL_HOLD_SEC = 0.50
CONTRAST_MIN = 3.2  # abaixo → backdrop

# Keywords (pt-BR) recebem cor secundária da paleta
ACCENT_WORDS = [
    "Inocente",
    "Órfão",
    "Herói",
    "Cuidador",
    "Explorador",
    "Rebelde",
    "Amante",
    "Criador",
    "Bobo da Corte",
    "Sábio",
    "Mago",
    "Governante",
    "sombra",
    "arquétipo",
    "subarquétipo",
    "dominante",
    "bio",
    "quiz",
    "diagnóstico",
    "perfil",
]

# Ordem: Inocente → Governante. Órfão usa pessoa_comum.jpg.
# Roteiros divididos em blocos curtos (≈3–6 palavras), timing ∝ texto.
ARCHETYPES = [
    {
        "slug": "01-inocente",
        "card": "inocente.jpg",
        "title": "O Inocente",
        "lines": [
            "Você acha que só tem",
            "bom coração...",
            "ou está evitando encarar",
            "o que as pessoas mostram",
            "nas atitudes?",
            "O Inocente quer paz,",
            "leveza e confiança genuína.",
            "O problema é que,",
            "quando a sombra entra,",
            "você ignora sinais claros",
            "só para não quebrar o clima —",
            "e acaba pagando caro depois.",
            "Isso é só uma fatia",
            "dessa carta.",
            "Faça o teste da bio,",
            "responda com as suas palavras",
            "e descubra seu arquétipo",
            "dominante e sua sombra.",
        ],
    },
    {
        "slug": "02-orfao",
        "card": "pessoa_comum.jpg",
        "title": "O Órfão",
        "lines": [
            "Se encaixar e não gerar atrito",
            "te dá paz...",
            "ou só te faz engolir",
            "o que você realmente sente?",
            "O Órfão tem empatia real",
            "e pé no chão,",
            "mas na sombra vive",
            "com medo de ser deixado",
            "de lado",
            "e adia assumir",
            "o próprio comando.",
            "Quer saber se esse é",
            "o seu arquétipo principal",
            "ou só um modo de defesa?",
            "O diagnóstico completo está",
            "no link da bio.",
        ],
    },
    {
        "slug": "03-heroi",
        "card": "heroi.jpg",
        "title": "O Herói",
        "lines": [
            "Se você parar de lutar",
            "por cinco minutos,",
            "o que sobra",
            "da sua identidade?",
            "O Herói tem coragem,",
            "disciplina e aguenta pancada",
            "que muita gente não aguenta.",
            "Só que na sombra,",
            "você transforma tudo",
            "numa batalha",
            "e só se sente válido",
            "quando está provando algo.",
            "Veja onde você está",
            "agindo por força",
            "e onde está se esgotando —",
            "faça o quiz",
            "no link da bio.",
        ],
    },
    {
        "slug": "04-cuidador",
        "card": "cuidador.jpg",
        "title": "O Cuidador",
        "lines": [
            "Ajudar todo mundo",
            "é amor de verdade...",
            "ou é o jeito",
            "que você encontrou",
            "para não olhar",
            "para o seu próprio cansaço?",
            "O Cuidador acolhe,",
            "sustenta e protege.",
            "Mas na sombra,",
            "você carrega o peso",
            "dos outros,",
            "guarda mágoa em silêncio",
            "e sente culpa",
            "quando precisa dizer não.",
            "Descubra o seu dominante,",
            "seu subarquétipo",
            "e o que a sua sombra esconde",
            "no link da bio.",
        ],
    },
    {
        "slug": "05-explorador",
        "card": "explorador.jpg",
        "title": "O Explorador",
        "lines": [
            "Você ama a liberdade...",
            "ou só foge toda vez",
            "que algo exige",
            "constância e profundidade?",
            "O Explorador precisa",
            "de espaço, movimento",
            "e verdade própria",
            "para respirar.",
            "O risco é trocar de rota",
            "sempre que a novidade",
            "perde o brilho",
            "e deixar coisas importantes",
            "pela metade.",
            "Quer ver como",
            "o seu perfil funciona",
            "na prática?",
            "Faça o teste completo",
            "no link da bio.",
        ],
    },
    {
        "slug": "06-rebelde",
        "card": "rebelde.jpg",
        "title": "O Rebelde",
        "lines": [
            "Você quebra padrões",
            "por consciência...",
            "ou reage contra",
            "qualquer limite",
            "só por impulso?",
            "O Rebelde enxerga",
            "o que está podre",
            "ou ultrapassado",
            "e tem coragem de romper.",
            "Na sombra, porém,",
            "você pode sabotar",
            "a própria estabilidade",
            "só para provar",
            "que ninguém manda em você.",
            "Descubra qual arquétipo",
            "comanda suas decisões",
            "de verdade —",
            "link na bio.",
        ],
    },
    {
        "slug": "07-amante",
        "card": "amante.jpg",
        "title": "O Amante",
        "lines": [
            "Você vive tudo",
            "com intensidade...",
            "ou entrega o seu",
            "equilíbrio emocional",
            "nas mãos de quem",
            "você quer por perto?",
            "O Amante traz presença,",
            "entrega e sensibilidade rara.",
            "O ponto cego é",
            "se perder de si mesmo",
            "na tentativa de manter",
            "conexão ou aprovação.",
            "Faça o quiz na bio,",
            "responda no seu jeito",
            "e veja a leitura completa",
            "do seu perfil.",
        ],
    },
    {
        "slug": "08-criador",
        "card": "criador.jpg",
        "title": "O Criador",
        "lines": [
            "Quantas ideias boas",
            "você já segurou",
            "na cabeça",
            "esperando o momento",
            "ou a forma 'perfeita'?",
            "O Criador tem visão,",
            "originalidade",
            "e quer construir algo",
            "com alma.",
            "Na sombra,",
            "o perfeccionismo",
            "e o excesso de idealização",
            "travam a execução",
            "antes mesmo de começar.",
            "Descubra o que destrava",
            "o seu arquétipo",
            "e veja sua sombra",
            "no link da bio.",
        ],
    },
    {
        "slug": "09-bobo-da-corte",
        "card": "bobo_da_corte.jpg",
        "title": "O Bobo da Corte",
        "lines": [
            "A piada alivia",
            "o ambiente...",
            "ou é a armadura",
            "que você usa",
            "para ninguém ver",
            "onde realmente dói?",
            "O Bobo da Corte tem",
            "inteligência social,",
            "timing e leveza",
            "que desarmam tensões.",
            "O perigo é usar",
            "o deboche ou o humor",
            "para fugir de conversas sérias",
            "e da própria vulnerabilidade.",
            "Quer enxergar o que está",
            "por trás da sua postura?",
            "Faça o teste",
            "no link da bio.",
        ],
    },
    {
        "slug": "10-sabio",
        "card": "sabio.jpg",
        "title": "O Sábio",
        "lines": [
            "Você está analisando",
            "com calma...",
            "ou usando a lógica",
            "como desculpa elegante",
            "para adiar a ação?",
            "O Sábio busca clareza,",
            "verdade e entendimento",
            "profundo",
            "antes de se mover.",
            "Na sombra,",
            "o excesso de análise",
            "vira paralisia",
            "e distância emocional.",
            "Descubra seu arquétipo dominante,",
            "seu subarquétipo",
            "e seus pontos cegos",
            "no link da bio.",
        ],
    },
    {
        "slug": "11-mago",
        "card": "mago.jpg",
        "title": "O Mago",
        "lines": [
            "Você enxerga o que",
            "os outros não veem...",
            "mas usa isso",
            "para transformar",
            "ou para manter tudo",
            "sob controle?",
            "O Mago lê cenários,",
            "conecta pontos",
            "e provoca viradas reais.",
            "Na sombra,",
            "esse poder pode virar",
            "manipulação sutil",
            "ou desconexão",
            "do que é simples e concreto.",
            "Faça o diagnóstico completo",
            "no link da bio",
            "e veja como",
            "suas escolhas se conectam.",
        ],
    },
    {
        "slug": "12-governante",
        "card": "governante.jpg",
        "title": "O Governante",
        "lines": [
            "Assumir o comando",
            "te fortalece...",
            "ou te prende",
            "num lugar",
            "onde você não pode falhar",
            "nem pedir ajuda?",
            "O Governante organiza,",
            "lidera e sustenta estruturas.",
            "Na sombra,",
            "o controle excessivo",
            "e a rigidez",
            "cobram um preço alto",
            "na sua paz",
            "e nas suas relações.",
            "Descubra seu mapa completo",
            "(dominante, subarquétipo e sombra)",
            "no link da bio.",
        ],
    },
]


def find_tool(name: str) -> str:
    path = shutil.which(name)
    if path:
        return path
    for d in KNOWN_FFMPEG_DIRS:
        candidate = d / f"{name}.exe"
        if candidate.is_file():
            return str(candidate)
    # Varredura leve no pacote WinGet
    winget = Path(r"C:\Users\Next\AppData\Local\Microsoft\WinGet\Packages")
    if winget.is_dir():
        matches = list(winget.glob(f"**/bin/{name}.exe"))
        if matches:
            return str(matches[0])
    raise SystemExit(
        f"{name} não encontrado. Instale (winget install Gyan.FFmpeg) e reabra o terminal."
    )


def find_ffmpeg() -> str:
    return find_tool("ffmpeg")


def find_ffprobe() -> str:
    return find_tool("ffprobe")


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(c: float) -> float:
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def saturation(rgb: tuple[int, int, int]) -> float:
    r, g, b = [c / 255.0 for c in rgb]
    _h, s, _v = colorsys.rgb_to_hsv(r, g, b)
    return s


def value(rgb: tuple[int, int, int]) -> float:
    r, g, b = [c / 255.0 for c in rgb]
    _h, _s, v = colorsys.rgb_to_hsv(r, g, b)
    return v


def sample_center_avg(card: Path) -> tuple[int, int, int]:
    """Média da região central (área típica da legenda TikTok)."""
    with Image.open(card) as im:
        im = im.convert("RGB")
        w, h = im.size
        box = (int(w * 0.15), int(h * 0.35), int(w * 0.85), int(h * 0.70))
        avg = im.crop(box).resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    return (int(avg[0]), int(avg[1]), int(avg[2]))


def quantize_palette(card: Path, n: int = 8) -> list[tuple[int, int, int]]:
    with Image.open(card) as im:
        im = im.convert("RGB")
        q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
        palette = q.getpalette() or []
        hist = q.histogram()
        ranked = sorted(range(min(n, len(hist))), key=lambda i: hist[i], reverse=True)
        colors: list[tuple[int, int, int]] = []
        for idx in ranked:
            if hist[idx] <= 0:
                continue
            base = idx * 3
            if base + 2 >= len(palette):
                continue
            colors.append((palette[base], palette[base + 1], palette[base + 2]))
        return colors


def extract_palette(card: Path) -> dict:
    """
    Paleta dominante via ColorThief + quantização Pillow.
    Retorna primary, secondary, center_avg, needs_backdrop, approach note.
    """
    thief = ColorThief(str(card))
    dominant = thief.get_color(quality=1)
    try:
        ct_palette = thief.get_palette(color_count=6, quality=1)
    except Exception:  # noqa: BLE001
        ct_palette = [dominant]

    q_palette = quantize_palette(card, n=8)
    # merge: ColorThief primeiro, depois quantização
    merged: list[tuple[int, int, int]] = []
    for c in list(ct_palette) + q_palette:
        rgb = (int(c[0]), int(c[1]), int(c[2]))
        if rgb not in merged:
            merged.append(rgb)

    # candidatos vibrantes (não quase-preto / quase-branco)
    scored = []
    for rgb in merged:
        sat = saturation(rgb)
        val = value(rgb)
        if val < 0.12 or val > 0.95:
            continue
        # favorece saturação + luminosidade média-alta
        score = sat * 1.6 + (1.0 - abs(val - 0.55)) * 0.6
        scored.append((score, rgb))
    scored.sort(key=lambda x: x[0], reverse=True)

    if not scored:
        primary = dominant
        secondary = merged[1] if len(merged) > 1 else (220, 200, 140)
    else:
        primary = scored[0][1]
        secondary = scored[1][1] if len(scored) > 1 else (
            merged[1] if len(merged) > 1 else (240, 220, 160)
        )

    # secundária precisa ser perceptivelmente diferente
    if contrast_ratio(primary, secondary) < 1.25 and len(scored) > 2:
        secondary = scored[2][1]

    center = sample_center_avg(card)
    # contraste texto (primary) vs fundo médio da carta
    cr = contrast_ratio(primary, center)
    needs_backdrop = cr < CONTRAST_MIN

    # se backdrop, clareia primary/secondary se ainda escuros demais no box
    if needs_backdrop:
        box_bg = (10, 10, 14)
        if contrast_ratio(primary, box_bg) < 3.0:
            # clarear primary mantendo matiz
            r, g, b = [c / 255.0 for c in primary]
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            v = max(v, 0.78)
            s = min(s, 0.85)
            pr, pg, pb = colorsys.hsv_to_rgb(h, s, v)
            primary = (int(pr * 255), int(pg * 255), int(pb * 255))
        if contrast_ratio(secondary, box_bg) < 2.5:
            r, g, b = [c / 255.0 for c in secondary]
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            v = max(v, 0.82)
            pr, pg, pb = colorsys.hsv_to_rgb(h, s, v)
            secondary = (int(pr * 255), int(pg * 255), int(pb * 255))

    return {
        "primary": primary,
        "secondary": secondary,
        "center": center,
        "contrast": round(cr, 2),
        "needs_backdrop": needs_backdrop,
        "palette": merged[:6],
        "approach": "ColorThief dominant+palette + Pillow median-cut quantize",
    }


def rgb_to_ass(rgb: tuple[int, int, int], alpha: int = 0) -> str:
    """ASS &HAABBGGRR (alpha 00=opaco)."""
    r, g, b = rgb
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def phrase_duration(text: str) -> float:
    chars = len(text.strip())
    sec = chars / CHARS_PER_SEC
    return max(MIN_PHRASE_SEC, min(MAX_PHRASE_SEC, sec))


def build_timeline(lines: list[str]) -> tuple[list[tuple[float, float, str]], float]:
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


def escape_ass_text(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )


def ass_color_no_alpha(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    return f"&H{b:02X}{g:02X}{r:02X}&"


def accentize(
    text: str,
    primary: tuple[int, int, int],
    secondary: tuple[int, int, int],
) -> str:
    """Aplica cor secundária em keywords (case-insensitive; frases longas primeiro)."""
    safe = escape_ass_text(text)
    pri = ass_color_no_alpha(primary)
    sec = ass_color_no_alpha(secondary)
    words = sorted(ACCENT_WORDS, key=len, reverse=True)
    pattern = re.compile(
        "(" + "|".join(re.escape(w) for w in words) + ")",
        re.IGNORECASE,
    )

    def repl(m: re.Match[str]) -> str:
        return f"{{\\c{sec}}}{m.group(0)}{{\\c{pri}}}"

    return pattern.sub(repl, safe)


def write_ass(
    path: Path,
    segments: list[tuple[float, float, str]],
    title: str,
    primary: tuple[int, int, int],
    secondary: tuple[int, int, int],
    needs_backdrop: bool,
) -> None:
    # Outline preto; sombra suave
    outline = rgb_to_ass((0, 0, 0), alpha=0)
    # backdrop rgba(10,10,14,0.78) → alpha ASS ≈ 0x38
    back = rgb_to_ass((10, 10, 14), alpha=0x38 if needs_backdrop else 0x80)
    border_style = 3 if needs_backdrop else 1
    outline_w = 6 if needs_backdrop else 4
    shadow = 3 if needs_backdrop else 2

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
Style: Caption,Arial Black,62,{rgb_to_ass(primary)},{rgb_to_ass(secondary)},{outline},{back},-1,0,0,0,100,100,0,0,{border_style},{outline_w},{shadow},5,120,120,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for start, end, text in segments:
        body = accentize(text, primary, secondary)
        events.append(
            f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},Caption,,0,0,0,,{body}"
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
) -> tuple[Path, dict]:
    card = CARDS_DIR / arch["card"]
    if not card.exists():
        raise SystemExit(f"Carta não encontrada: {card}")

    palette = extract_palette(card)
    print(
        f"  palette primary={palette['primary']} secondary={palette['secondary']} "
        f"contrast={palette['contrast']} backdrop={palette['needs_backdrop']}"
    )

    segments, duration = build_timeline(arch["lines"])
    frames = max(int(round(duration * FPS)), FPS)
    zoom_end = 1.10
    zoom_expr = f"1+({zoom_end}-1)*on/{max(frames - 1, 1)}"

    ass_path = work_dir / f"{arch['slug']}.ass"
    write_ass(
        ass_path,
        segments,
        arch["title"],
        palette["primary"],
        palette["secondary"],
        palette["needs_backdrop"],
    )

    out_path = out_dir / f"{arch['slug']}.mp4"
    fade_start = max(0.0, duration - FADE_OUT_SEC)

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

    if not out_path.exists() or out_path.stat().st_size < 10_000:
        raise SystemExit(f"Saída inválida: {out_path}")
    probe_duration(ffprobe, out_path)
    return out_path, palette


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera vídeos TikTok dos 12 arquétipos")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Pasta de saída dos MP4")
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

    print(f"Repo:   {REPO_ROOT}")
    print(f"Cartas: {CARDS_DIR}")
    print(f"Trilha: {AUDIO_PATH}")
    print(f"Saída:  {out_dir}")
    print(f"ffmpeg: {ffmpeg}")

    results = []
    with tempfile.TemporaryDirectory(prefix="tiktok-archetypes-") as tmp:
        work = Path(tmp)
        for arch in selected:
            print(f"\n=== {arch['slug']} ({arch['title']}) ===")
            path, palette = generate_one(ffmpeg, ffprobe, arch, out_dir, work)
            dur = probe_duration(ffprobe, path)
            size = path.stat().st_size
            results.append((path, size, dur, palette))
            print(f"OK {path.name}  {size/1_000_000:.2f} MB  {dur:.1f}s")

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

    print("\n--- Paletas ---")
    for path, size, dur, palette in results:
        print(
            f"{path.name}: primary={palette['primary']} secondary={palette['secondary']} "
            f"contrast={palette['contrast']} backdrop={palette['needs_backdrop']}"
        )

    print(f"\nConcluído: {len(expected)} vídeo(s) em {out_dir}")
    print(f"Approach: {results[0][3]['approach'] if results else 'n/a'}")


if __name__ == "__main__":
    main()
