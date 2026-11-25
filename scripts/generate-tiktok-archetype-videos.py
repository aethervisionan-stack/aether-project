#!/usr/bin/env python3
"""
Gera 12 vídeos verticais TikTok (9:16) dos arquétipos do quiz medieval.

Extrai paleta dominante de cada carta (ColorThief + quantização Pillow),
aplica cor principal no texto e secundária em keywords; se contraste baixo,
usa backdrop escuro + stroke + sombra.

Narração PT-BR: edge-tts (padrão) → ElevenLabs (se ELEVENLABS_API_KEY +
TTS_ENGINE=elevenlabs) → Windows SAPI → sem voz (só trilha + aviso).

Uso:
  python scripts/generate-tiktok-archetype-videos.py
  python scripts/generate-tiktok-archetype-videos.py --only 01-inocente
  python scripts/generate-tiktok-archetype-videos.py --engine edge
  python scripts/generate-tiktok-archetype-videos.py --engine sapi
  python scripts/generate-tiktok-archetype-videos.py --engine none
"""

from __future__ import annotations

import argparse
import asyncio
import colorsys
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
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
# Trilha sob narração (mais baixa); sobe um pouco se não houver voz
MUSIC_VOLUME_WITH_VOICE = 0.10
MUSIC_VOLUME_NO_VOICE = 0.16
VOICE_VOLUME = 1.05
FADE_OUT_SEC = 1.6
# Timing estimado (só fallback sem TTS)
CHARS_PER_SEC = 13.0
MIN_PHRASE_SEC = 1.25
MAX_PHRASE_SEC = 4.2
GAP_SEC = 0.12
LEAD_IN_SEC = 0.35
TAIL_HOLD_SEC = 0.55
CONTRAST_MIN = 3.2  # abaixo → backdrop

# Ritmo/tom por personalidade
TONE_FIRME = "firme"  # Governante / Sábio / Herói / Mago
TONE_LEVE = "leve"  # Inocente / Explorador / Órfão / Bobo
TONE_INTENSO = "intenso"  # Amante / Rebelde / Criador / Cuidador

VOICE_PROFILES = {
    TONE_FIRME: {
        "edge_voice": "pt-BR-AntonioNeural",
        "edge_rate": "-10%",
        "edge_pitch": "-2Hz",
        "sapi_rate": -3,  # -10..10
        "eleven_stability": 0.55,
        "eleven_similarity": 0.75,
        "eleven_style": 0.15,
    },
    TONE_LEVE: {
        "edge_voice": "pt-BR-FranciscaNeural",
        "edge_rate": "+6%",
        "edge_pitch": "+1Hz",
        "sapi_rate": 2,
        "eleven_stability": 0.40,
        "eleven_similarity": 0.70,
        "eleven_style": 0.35,
    },
    TONE_INTENSO: {
        "edge_voice": "pt-BR-FranciscaNeural",
        "edge_rate": "-4%",
        "edge_pitch": "-1Hz",
        "sapi_rate": -1,
        "eleven_stability": 0.35,
        "eleven_similarity": 0.80,
        "eleven_style": 0.45,
    },
}

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
# Roteiros profundos em blocos curtos; timing real vem do TTS.
ARCHETYPES = [
    {
        "slug": "01-inocente",
        "card": "inocente.jpg",
        "title": "O Inocente",
        "tone": TONE_LEVE,
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
        "tone": TONE_LEVE,
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
        "tone": TONE_FIRME,
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
        "tone": TONE_INTENSO,
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
        "tone": TONE_LEVE,
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
        "tone": TONE_INTENSO,
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
        "tone": TONE_INTENSO,
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
        "tone": TONE_INTENSO,
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
        "tone": TONE_LEVE,
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
        "tone": TONE_FIRME,
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
        "tone": TONE_FIRME,
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
        "tone": TONE_FIRME,
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


def build_timeline_estimated(lines: list[str]) -> tuple[list[tuple[float, float, str]], float]:
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


def build_timeline_from_durs(
    lines: list[str], durs: list[float]
) -> tuple[list[tuple[float, float, str]], float]:
    t = LEAD_IN_SEC
    segments: list[tuple[float, float, str]] = []
    for i, (line, dur) in enumerate(zip(lines, durs)):
        start = t
        end = t + max(dur, 0.05)
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


def probe_stream(ffprobe: str, media: Path) -> dict:
    out = subprocess.check_output(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(media),
        ],
        text=True,
    )
    return json.loads(out)


# ---------------------------------------------------------------------------
# TTS engines
# ---------------------------------------------------------------------------


def resolve_engine(requested: str | None) -> tuple[str, str]:
    """
    Retorna (engine, note).
    Preferência: edge-tts; ElevenLabs só se chave + engine=elevenlabs;
    fallback SAPI; none = só trilha.
    """
    env_engine = (os.environ.get("TTS_ENGINE") or "").strip().lower()
    choice = (requested or env_engine or "auto").strip().lower()
    eleven_key = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()

    if choice in ("none", "off", "skip"):
        return "none", "voz desabilitada (--engine none)"

    if choice in ("elevenlabs", "eleven"):
        if not eleven_key:
            print(
                "AVISO: TTS_ENGINE/ --engine=elevenlabs sem ELEVENLABS_API_KEY; "
                "tentando edge-tts."
            )
        else:
            return "elevenlabs", "ElevenLabs (ELEVENLABS_API_KEY)"

    if choice in ("sapi", "windows", "win"):
        return "sapi", "Windows SAPI (System.Speech)"

    if choice in ("edge", "edge-tts", "auto", ""):
        try:
            import edge_tts  # noqa: F401

            return "edge", "edge-tts (pt-BR Neural)"
        except ImportError:
            print("AVISO: edge-tts não instalado (pip install edge-tts).")
            if eleven_key and choice == "auto":
                return "elevenlabs", "ElevenLabs (fallback; edge-tts ausente)"
            print("AVISO: tentando Windows SAPI.")
            return "sapi", "Windows SAPI (fallback; edge-tts ausente)"

    print(f"AVISO: engine desconhecido '{choice}'; usando edge-tts.")
    try:
        import edge_tts  # noqa: F401

        return "edge", "edge-tts (pt-BR Neural)"
    except ImportError:
        return "sapi", "Windows SAPI (fallback)"


async def _edge_save(
    text: str, out_path: Path, voice: str, rate: str, pitch: str
) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(str(out_path))


def synthesize_edge_lines(
    lines: list[str], tone: str, work_dir: Path
) -> list[Path]:
    profile = VOICE_PROFILES[tone]
    voice = profile["edge_voice"]
    rate = profile["edge_rate"]
    pitch = profile["edge_pitch"]
    paths: list[Path] = []

    async def all_lines() -> None:
        for i, line in enumerate(lines):
            out = work_dir / f"tts_{i:02d}.mp3"
            await _edge_save(line, out, voice, rate, pitch)
            paths.append(out)

    asyncio.run(all_lines())
    return paths


def synthesize_elevenlabs_lines(
    lines: list[str], tone: str, work_dir: Path
) -> list[Path]:
    api_key = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
    voice_id = (
        os.environ.get("ELEVENLABS_VOICE_ID") or "EXAVITQu4vr4xnSDxMaL"
    ).strip()  # default Rachel-ish; override via env
    model = (os.environ.get("ELEVENLABS_MODEL") or "eleven_multilingual_v2").strip()
    profile = VOICE_PROFILES[tone]
    paths: list[Path] = []

    for i, line in enumerate(lines):
        out = work_dir / f"tts_{i:02d}.mp3"
        payload = json.dumps(
            {
                "text": line,
                "model_id": model,
                "voice_settings": {
                    "stability": profile["eleven_stability"],
                    "similarity_boost": profile["eleven_similarity"],
                    "style": profile["eleven_style"],
                    "use_speaker_boost": True,
                },
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            data=payload,
            method="POST",
            headers={
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": api_key,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                out.write_bytes(resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"ElevenLabs HTTP {exc.code}: {body}") from exc
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"ElevenLabs falhou: {exc}") from exc
        paths.append(out)
    return paths


def synthesize_sapi_lines(
    lines: list[str], tone: str, work_dir: Path
) -> list[Path]:
    """Windows SAPI via PowerShell System.Speech → WAV por linha."""
    rate = int(VOICE_PROFILES[tone]["sapi_rate"])
    paths: list[Path] = []
    for i, line in enumerate(lines):
        out = work_dir / f"tts_{i:02d}.wav"
        # Escape for PowerShell single-quoted string
        safe = line.replace("'", "''")
        out_ps = str(out).replace("'", "''")
        ps = (
            "Add-Type -AssemblyName System.Speech; "
            "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            f"$s.Rate = {rate}; "
            f"$s.SetOutputToWaveFile('{out_ps}'); "
            f"$s.Speak('{safe}'); "
            "$s.Dispose();"
        )
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0 or not out.exists() or out.stat().st_size < 100:
            err = (proc.stderr or proc.stdout or "SAPI failed")[-800:]
            raise RuntimeError(f"SAPI falhou na linha {i}: {err}")
        paths.append(out)
    return paths


def make_silence_wav(ffmpeg: str, path: Path, duration: float, sr: int = 24000) -> None:
    run(
        [
            ffmpeg,
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"anullsrc=r={sr}:cl=mono",
            "-t",
            f"{duration:.3f}",
            "-c:a",
            "pcm_s16le",
            str(path),
        ]
    )


def concat_voice_track(
    ffmpeg: str,
    ffprobe: str,
    line_audios: list[Path],
    work_dir: Path,
    out_path: Path,
) -> list[float]:
    """Monta trilha de voz com lead-in + gaps; retorna duração de cada linha."""
    durs = [probe_duration(ffprobe, p) for p in line_audios]
    lead = work_dir / "silence_lead.wav"
    gap = work_dir / "silence_gap.wav"
    tail = work_dir / "silence_tail.wav"
    make_silence_wav(ffmpeg, lead, LEAD_IN_SEC)
    make_silence_wav(ffmpeg, gap, GAP_SEC)
    make_silence_wav(ffmpeg, tail, TAIL_HOLD_SEC)

    # Normaliza tudo para wav mono 24k antes do concat
    normalized: list[Path] = []
    for i, src in enumerate(line_audios):
        dst = work_dir / f"norm_{i:02d}.wav"
        run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(src),
                "-ar",
                "24000",
                "-ac",
                "1",
                "-c:a",
                "pcm_s16le",
                str(dst),
            ]
        )
        normalized.append(dst)

    concat_list = work_dir / "voice_concat.txt"
    parts: list[str] = [f"file '{lead.resolve().as_posix()}'"]
    for i, n in enumerate(normalized):
        parts.append(f"file '{n.resolve().as_posix()}'")
        if i < len(normalized) - 1:
            parts.append(f"file '{gap.resolve().as_posix()}'")
    parts.append(f"file '{tail.resolve().as_posix()}'")
    concat_list.write_text("\n".join(parts) + "\n", encoding="utf-8")

    run(
        [
            ffmpeg,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c:a",
            "pcm_s16le",
            str(out_path),
        ]
    )
    return durs


def synthesize_narration(
    engine: str,
    lines: list[str],
    tone: str,
    ffmpeg: str,
    ffprobe: str,
    work_dir: Path,
) -> tuple[Path | None, list[tuple[float, float, str]], float, str]:
    """
    Gera trilha de voz + timeline sync.
    Retorna (voice_wav|None, segments, duration, detail).
    """
    if engine == "none":
        segments, duration = build_timeline_estimated(lines)
        return None, segments, duration, "sem voz (timeline estimada)"

    try:
        if engine == "edge":
            line_audios = synthesize_edge_lines(lines, tone, work_dir)
            detail = (
                f"edge-tts {VOICE_PROFILES[tone]['edge_voice']} "
                f"rate={VOICE_PROFILES[tone]['edge_rate']} "
                f"pitch={VOICE_PROFILES[tone]['edge_pitch']} tone={tone}"
            )
        elif engine == "elevenlabs":
            line_audios = synthesize_elevenlabs_lines(lines, tone, work_dir)
            detail = f"ElevenLabs tone={tone}"
        elif engine == "sapi":
            line_audios = synthesize_sapi_lines(lines, tone, work_dir)
            detail = f"Windows SAPI rate={VOICE_PROFILES[tone]['sapi_rate']} tone={tone}"
        else:
            segments, duration = build_timeline_estimated(lines)
            return None, segments, duration, f"engine desconhecido ({engine})"

        voice_path = work_dir / "voice_track.wav"
        durs = concat_voice_track(ffmpeg, ffprobe, line_audios, work_dir, voice_path)
        segments, duration = build_timeline_from_durs(lines, durs)
        # Ajusta duração total à trilha real (lead+lines+gaps+tail)
        real = probe_duration(ffprobe, voice_path)
        duration = max(duration, real)
        return voice_path, segments, duration, detail
    except Exception as exc:  # noqa: BLE001
        print(f"AVISO: TTS ({engine}) falhou ({exc}); gerando sem voz.")
        segments, duration = build_timeline_estimated(lines)
        return None, segments, duration, f"fallback sem voz ({engine} falhou: {exc})"


def generate_one(
    ffmpeg: str,
    ffprobe: str,
    arch: dict,
    out_dir: Path,
    work_dir: Path,
    engine: str,
) -> tuple[Path, dict]:
    card = CARDS_DIR / arch["card"]
    if not card.exists():
        raise SystemExit(f"Carta não encontrada: {card}")

    palette = extract_palette(card)
    print(
        f"  palette primary={palette['primary']} secondary={palette['secondary']} "
        f"contrast={palette['contrast']} backdrop={palette['needs_backdrop']}"
    )

    arch_work = work_dir / arch["slug"]
    arch_work.mkdir(parents=True, exist_ok=True)

    voice_path, segments, duration, tts_detail = synthesize_narration(
        engine,
        arch["lines"],
        arch.get("tone", TONE_LEVE),
        ffmpeg,
        ffprobe,
        arch_work,
    )
    print(f"  TTS: {tts_detail}  duration≈{duration:.2f}s")
    palette["tts"] = tts_detail
    palette["has_voice"] = voice_path is not None

    frames = max(int(round(duration * FPS)), FPS)
    zoom_end = 1.10
    zoom_expr = f"1+({zoom_end}-1)*on/{max(frames - 1, 1)}"

    ass_path = arch_work / f"{arch['slug']}.ass"
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

    if voice_path is not None:
        # 0=card, 1=voice, 2=music — ducking da trilha sob a fala
        music_vol = MUSIC_VOLUME_WITH_VOICE
        af = (
            f"[1:a]volume={VOICE_VOLUME},"
            f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"asplit=2[voice][sc];"
            f"[2:a]volume={music_vol},"
            f"afade=t=out:st={fade_start:.3f}:d={FADE_OUT_SEC},"
            f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[music];"
            f"[music][sc]sidechaincompress="
            f"threshold=0.02:ratio=6:attack=40:release=350:makeup=1:mix=0.85[ducked];"
            f"[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:"
            f"normalize=0[aout]"
        )
        cmd = [
            ffmpeg,
            "-y",
            "-loop",
            "1",
            "-i",
            str(card),
            "-i",
            str(voice_path),
            "-i",
            str(AUDIO_PATH),
            "-vf",
            vf,
            "-filter_complex",
            af,
            "-map",
            "0:v",
            "-map",
            "[aout]",
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
            "192k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
    else:
        music_vol = MUSIC_VOLUME_NO_VOICE
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
            f"volume={music_vol},afade=t=out:st={fade_start:.3f}:d={FADE_OUT_SEC}",
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
    parser.add_argument(
        "--engine",
        choices=["auto", "edge", "elevenlabs", "sapi", "none"],
        default="auto",
        help="Motor de voz (padrão: edge-tts; elevenlabs exige ELEVENLABS_API_KEY)",
    )
    args = parser.parse_args()

    if not CARDS_DIR.is_dir():
        raise SystemExit(f"Pasta de cartas não encontrada: {CARDS_DIR}")
    if not AUDIO_PATH.is_file():
        raise SystemExit(f"Trilha não encontrada: {AUDIO_PATH}")

    ffmpeg = find_ffmpeg()
    ffprobe = find_ffprobe()
    engine, engine_note = resolve_engine(args.engine)
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
    print(f"TTS:    {engine} — {engine_note}")

    results = []
    with tempfile.TemporaryDirectory(prefix="tiktok-archetypes-") as tmp:
        work = Path(tmp)
        for arch in selected:
            print(f"\n=== {arch['slug']} ({arch['title']}) tone={arch.get('tone')} ===")
            path, palette = generate_one(
                ffmpeg, ffprobe, arch, out_dir, work, engine
            )
            meta = probe_stream(ffprobe, path)
            stream = (meta.get("streams") or [{}])[0]
            fmt = meta.get("format") or {}
            dur = float(fmt.get("duration") or probe_duration(ffprobe, path))
            size = path.stat().st_size
            results.append((path, size, dur, palette, stream))
            print(
                f"OK {path.name}  {size/1_000_000:.2f} MB  {dur:.1f}s  "
                f"{stream.get('width')}x{stream.get('height')} @{stream.get('r_frame_rate')}"
            )

    print("\n--- Verificação ---")
    expected = [a["slug"] for a in (selected if args.only else ARCHETYPES)]
    errors = []
    for slug in expected:
        mp4 = out_dir / f"{slug}.mp4"
        if not mp4.exists():
            errors.append(f"faltando: {mp4}")
            continue
        try:
            meta = probe_stream(ffprobe, mp4)
            stream = (meta.get("streams") or [{}])[0]
            fmt = meta.get("format") or {}
            d = float(fmt.get("duration") or 0)
            w, h = stream.get("width"), stream.get("height")
            fps = stream.get("r_frame_rate")
            print(
                f"OK {mp4.name}\t{mp4.stat().st_size:>10} bytes\t{d:.2f}s\t"
                f"{w}x{h}\t{fps}"
            )
            if w != WIDTH or h != HEIGHT:
                errors.append(f"resolução errada: {mp4.name} {w}x{h}")
            if fps not in ("30/1", "30"):
                # zoompan força 30; aceita 30/1
                if fps != "30/1":
                    errors.append(f"fps inesperado: {mp4.name} {fps}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"não abre: {mp4} ({exc})")

    if errors:
        raise SystemExit("\n".join(errors))

    if not args.only and len(expected) != 12:
        raise SystemExit("Esperava 12 arquétipos")

    print("\n--- Paletas / TTS ---")
    for path, size, dur, palette, _stream in results:
        print(
            f"{path.name}: primary={palette['primary']} secondary={palette['secondary']} "
            f"contrast={palette['contrast']} backdrop={palette['needs_backdrop']} "
            f"voice={palette.get('has_voice')} | {palette.get('tts')}"
        )

    print(f"\nConcluído: {len(expected)} vídeo(s) em {out_dir}")
    print(f"Engine: {engine} — {engine_note}")
    print(f"Approach: {results[0][3]['approach'] if results else 'n/a'}")


if __name__ == "__main__":
    main()
