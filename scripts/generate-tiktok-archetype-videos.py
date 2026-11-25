#!/usr/bin/env python3
"""
Gera 12 vídeos verticais TikTok (9:16) dos arquétipos do quiz medieval.

Paleta de legenda: base escura profunda + acento da ilustração + texto claro
alto contraste; painel translúcido (~0.72) tingido com a base da carta.

Narração PT-BR fluida:
  - texto limpo para TTS (— / ... → vírgulas); legendas mantêm pontuação visual
  - ElevenLabs se ELEVENLABS_API_KEY (eleven_multilingual_v2)
  - senão edge-tts pt-BR ThalitaMultilingualNeural / AntonioNeural @ +10%
  - sync via WordBoundary (edge) ou duração real + proporção

Uso:
  python scripts/generate-tiktok-archetype-videos.py
  python scripts/generate-tiktok-archetype-videos.py --only 01-inocente
  python scripts/generate-tiktok-archetype-videos.py --engine edge
  python scripts/generate-tiktok-archetype-videos.py --engine elevenlabs
  python scripts/generate-tiktok-archetype-videos.py --engine none
"""

from __future__ import annotations

import argparse
import asyncio
import colorsys
import json
import math
import os
import random
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
LEAD_IN_SEC = 0.35
TAIL_HOLD_SEC = 0.55
# Pausas entre falas (edge: SSML-like via silêncio no concat)
GAP_MIN_SEC = 0.150
GAP_MAX_SEC = 0.220
GAP_AFTER_HOOK_SEC = 0.300
# Painel ASS: opacidade ~0.72 → alpha ASS (00=opaco) ≈ 0x47
PANEL_ALPHA_ASS = 0x47
PANEL_OPACITY = 0.72
CONTRAST_TEXT_MIN = 4.5

# Ritmo/tom por personalidade
TONE_FIRME = "firme"  # Governante / Sábio / Herói / Mago
TONE_LEVE = "leve"  # Inocente / Explorador / Órfão / Bobo
TONE_INTENSO = "intenso"  # Amante / Rebelde / Criador / Cuidador

# ElevenLabs: settings fixos pedidos; voz por tom via ELEVENLABS_VOICE_ID_* opcional
ELEVEN_STABILITY = 0.45
ELEVEN_SIMILARITY = 0.78
ELEVEN_STYLE = 0.35
ELEVEN_MODEL = "eleven_multilingual_v2"

VOICE_PROFILES = {
    TONE_FIRME: {
        "edge_voice": "pt-BR-AntonioNeural",
        "edge_rate": "+10%",
        "edge_pitch": "-1Hz",
        "sapi_rate": -1,
        "eleven_voice_env": "ELEVENLABS_VOICE_ID_MALE",
        "eleven_voice_default": "pNInz6obpgDQGcFmaJgB",  # Adam-ish
    },
    TONE_LEVE: {
        "edge_voice": "pt-BR-ThalitaMultilingualNeural",
        "edge_rate": "+10%",
        "edge_pitch": "+0Hz",
        "sapi_rate": 2,
        "eleven_voice_env": "ELEVENLABS_VOICE_ID_FEMALE",
        "eleven_voice_default": "EXAVITQu4vr4xnSDxMaL",  # Rachel-ish
    },
    TONE_INTENSO: {
        "edge_voice": "pt-BR-ThalitaMultilingualNeural",
        "edge_rate": "+10%",
        "edge_pitch": "-1Hz",
        "sapi_rate": 0,
        "eleven_voice_env": "ELEVENLABS_VOICE_ID_FEMALE",
        "eleven_voice_default": "EXAVITQu4vr4xnSDxMaL",
    },
}

# Keywords (pt-BR) recebem cor de acento
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


def load_env_files() -> None:
    """Carrega .env / .env.local sem sobrescrever variáveis já definidas."""
    for name in (".env", ".env.local"):
        path = REPO_ROOT / name
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            if not key or key in os.environ:
                continue
            val = val.strip()
            if (val.startswith('"') and val.endswith('"')) or (
                val.startswith("'") and val.endswith("'")
            ):
                val = val[1:-1]
            os.environ[key] = val


def find_tool(name: str) -> str:
    path = shutil.which(name)
    if path:
        return path
    for d in KNOWN_FFMPEG_DIRS:
        candidate = d / f"{name}.exe"
        if candidate.is_file():
            return str(candidate)
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


def darken_deep(rgb: tuple[int, int, int], target_v: float = 0.14) -> tuple[int, int, int]:
    r, g, b = [c / 255.0 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    s = min(max(s * 0.85, 0.15), 0.55)
    v = min(v, target_v)
    v = max(v, 0.06)
    pr, pg, pb = colorsys.hsv_to_rgb(h, s, v)
    return (int(pr * 255), int(pg * 255), int(pb * 255))


def lighten_for_text(rgb: tuple[int, int, int], min_v: float = 0.92) -> tuple[int, int, int]:
    r, g, b = [c / 255.0 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    s = min(s, 0.18)
    v = max(v, min_v)
    pr, pg, pb = colorsys.hsv_to_rgb(h, s, v)
    return (int(pr * 255), int(pg * 255), int(pb * 255))


def boost_accent(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    r, g, b = [c / 255.0 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    s = min(max(s, 0.45), 0.92)
    v = max(min(v, 0.88), 0.55)
    pr, pg, pb = colorsys.hsv_to_rgb(h, s, v)
    return (int(pr * 255), int(pg * 255), int(pb * 255))


def sample_center_avg(card: Path) -> tuple[int, int, int]:
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
    Base escura profunda + acento da ilustração + texto claro alto contraste.
    Painel tingido com a base da carta (alpha ~0.72).
    """
    thief = ColorThief(str(card))
    dominant = thief.get_color(quality=1)
    try:
        ct_palette = thief.get_palette(color_count=6, quality=1)
    except Exception:  # noqa: BLE001
        ct_palette = [dominant]

    q_palette = quantize_palette(card, n=8)
    merged: list[tuple[int, int, int]] = []
    for c in list(ct_palette) + q_palette:
        rgb = (int(c[0]), int(c[1]), int(c[2]))
        if rgb not in merged:
            merged.append(rgb)

    # Base: cor mais escura (não preto puro) da carta → aprofundada
    dark_candidates = sorted(
        [c for c in merged if value(c) < 0.55],
        key=lambda c: (value(c), -saturation(c)),
    )
    if dark_candidates:
        base_src = dark_candidates[0]
    else:
        base_src = min(merged, key=value) if merged else dominant
    base = darken_deep(base_src, target_v=0.12)

    # Acento: mais saturado / vibrante da ilustração
    accent_scored = []
    for rgb in merged:
        sat = saturation(rgb)
        val = value(rgb)
        if val < 0.15 or val > 0.92:
            continue
        score = sat * 2.0 + (1.0 - abs(val - 0.50)) * 0.5
        accent_scored.append((score, rgb))
    accent_scored.sort(key=lambda x: x[0], reverse=True)
    if accent_scored:
        accent = boost_accent(accent_scored[0][1])
    else:
        accent = boost_accent(dominant)

    # Texto claro alto contraste vs painel
    text = (245, 242, 235)
    if contrast_ratio(text, base) < CONTRAST_TEXT_MIN:
        text = lighten_for_text((255, 255, 255), min_v=0.95)
    # Acento legível no painel
    if contrast_ratio(accent, base) < 2.8:
        accent = lighten_for_text(accent, min_v=0.78)
        accent = boost_accent(accent)

    center = sample_center_avg(card)
    return {
        "base": base,
        "accent": accent,
        "text": text,
        "primary": text,  # compat: texto principal
        "secondary": accent,  # compat: keywords
        "center": center,
        "contrast": round(contrast_ratio(text, base), 2),
        "needs_backdrop": True,
        "panel_alpha": PANEL_OPACITY,
        "palette": merged[:6],
        "approach": (
            f"deep base + illustration accent + light text; "
            f"panel alpha={PANEL_OPACITY}"
        ),
    }


def rgb_to_ass(rgb: tuple[int, int, int], alpha: int = 0) -> str:
    """ASS &HAABBGGRR (alpha 00=opaco)."""
    r, g, b = rgb
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def clean_tts_text(text: str) -> str:
    """Versão limpa para TTS: — e ... viram vírgulas; legendas mantêm visual."""
    t = text
    t = t.replace("—", ",")
    t = t.replace("–", ",")
    t = t.replace("…", ",")
    t = re.sub(r"\.{3,}", ",", t)
    t = re.sub(r"\s*,\s*", ", ", t)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\s+([?!.])", r"\1", t)
    return t.strip(" ,")


def group_utterances(lines: list[str]) -> list[list[str]]:
    """
    Agrupa linhas em falas contínuas até . ? ! finais.
    Ellipsis (...) / … NÃO fecham fala — costumam ser gancho retórico
    ('paz... ou só engolir?').
    """
    groups: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        current.append(line)
        stripped = line.rstrip()
        if stripped.endswith("?") or stripped.endswith("!"):
            groups.append(current)
            current = []
        elif stripped.endswith(".") and not stripped.endswith("..."):
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    return groups


def phrase_duration(text: str) -> float:
    chars = len(text.strip())
    sec = chars / CHARS_PER_SEC
    return max(MIN_PHRASE_SEC, min(MAX_PHRASE_SEC, sec))


def build_timeline_estimated(
    lines: list[str],
) -> tuple[list[tuple[float, float, str]], float]:
    t = LEAD_IN_SEC
    segments: list[tuple[float, float, str]] = []
    for i, line in enumerate(lines):
        dur = phrase_duration(line)
        start = t
        end = t + dur
        segments.append((start, end, line))
        gap = GAP_AFTER_HOOK_SEC if i == 0 and "?" in line else (
            GAP_MIN_SEC + (GAP_MAX_SEC - GAP_MIN_SEC) * 0.5
        )
        t = end + (gap if i < len(lines) - 1 else 0)
    total = t + TAIL_HOLD_SEC
    return segments, total


def gap_after_utterance(index: int, utterance_lines: list[str], rng: random.Random) -> float:
    joined = " ".join(utterance_lines)
    if index == 0 and "?" in joined:
        return GAP_AFTER_HOOK_SEC
    return rng.uniform(GAP_MIN_SEC, GAP_MAX_SEC)


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
    text_rgb: tuple[int, int, int],
    accent_rgb: tuple[int, int, int],
    base_rgb: tuple[int, int, int],
) -> None:
    """
    Painel translúcido tingido com base da carta, borda/acento, stroke + sombra.
    Área segura TikTok: margens laterais + Alignment 2 (baixo) MarginV ~420.
    """
    outline = rgb_to_ass((0, 0, 0), alpha=0)
    back = rgb_to_ass(base_rgb, alpha=PANEL_ALPHA_ASS)
    # Outline color also doubles as box border tint when BorderStyle=3;
    # use darkened accent for a subtle frame feel via OutlineColour.
    border = rgb_to_ass(darken_deep(accent_rgb, target_v=0.22), alpha=0)

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
Style: Caption,Arial Black,60,{rgb_to_ass(text_rgb)},{rgb_to_ass(accent_rgb)},{border},{back},-1,0,0,0,100,100,0,0,3,5,3,2,100,100,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for start, end, text in segments:
        body = accentize(text, text_rgb, accent_rgb)
        # Borda de acento via shadow color nudge + leading tag
        tagged = (
            f"{{\\bord5\\shad3\\3c{ass_color_no_alpha(accent_rgb)}"
            f"\\4c{ass_color_no_alpha(base_rgb)}}}{body}"
        )
        events.append(
            f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},Caption,,0,0,0,,{tagged}"
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
    Preferência: ElevenLabs se ELEVENLABS_API_KEY; senão edge-tts;
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
                "AVISO: --engine=elevenlabs sem ELEVENLABS_API_KEY; tentando edge-tts."
            )
        else:
            return (
                "elevenlabs",
                f"ElevenLabs {ELEVEN_MODEL} "
                f"(stab={ELEVEN_STABILITY} sim={ELEVEN_SIMILARITY} style={ELEVEN_STYLE})",
            )

    if choice in ("sapi", "windows", "win"):
        return "sapi", "Windows SAPI (System.Speech)"

    if choice in ("edge", "edge-tts"):
        try:
            import edge_tts  # noqa: F401

            return "edge", "edge-tts (ThalitaMultilingual / Antonio @ +10%)"
        except ImportError:
            print("AVISO: edge-tts não instalado.")
            if eleven_key:
                return "elevenlabs", "ElevenLabs (fallback; edge-tts ausente)"
            return "sapi", "Windows SAPI (fallback; edge-tts ausente)"

    # auto: ElevenLabs se chave; senão edge
    if choice in ("auto", ""):
        if eleven_key:
            return (
                "elevenlabs",
                f"ElevenLabs {ELEVEN_MODEL} "
                f"(stab={ELEVEN_STABILITY} sim={ELEVEN_SIMILARITY} style={ELEVEN_STYLE})",
            )
        try:
            import edge_tts  # noqa: F401

            return "edge", "edge-tts (ThalitaMultilingual / Antonio @ +10%)"
        except ImportError:
            print("AVISO: edge-tts não instalado; tentando SAPI.")
            return "sapi", "Windows SAPI (fallback)"

    print(f"AVISO: engine desconhecido '{choice}'; usando auto.")
    return resolve_engine("auto")


def _ticks_to_sec(ticks: int | float) -> float:
    return float(ticks) / 10_000_000.0


def _normalize_word(w: str) -> str:
    return re.sub(r"[^\wàáâãäéêëíîïóôõöúûüçñ]", "", w, flags=re.IGNORECASE).lower()


def map_lines_from_word_boundaries(
    display_lines: list[str],
    boundaries: list[dict],
    audio_dur: float,
) -> list[tuple[float, float]]:
    """
    Mapeia cada linha de legenda para (start, end) relativos ao áudio da fala,
    usando WordBoundary (ticks) quando possível.
    """
    line_words: list[list[str]] = []
    for line in display_lines:
        words = [_normalize_word(w) for w in line.split() if _normalize_word(w)]
        line_words.append(words)

    wb_words = []
    for b in boundaries:
        if b.get("type") != "WordBoundary":
            continue
        nw = _normalize_word(str(b.get("text", "")))
        if not nw:
            continue
        wb_words.append(
            (
                nw,
                _ticks_to_sec(b["offset"]),
                _ticks_to_sec(b["offset"]) + _ticks_to_sec(b["duration"]),
            )
        )

    if not wb_words:
        # fallback proporcional por caracteres
        total_chars = sum(max(len(l.strip()), 1) for l in display_lines)
        t = 0.0
        spans: list[tuple[float, float]] = []
        for line in display_lines:
            share = max(len(line.strip()), 1) / total_chars
            dur = max(audio_dur * share, 0.08)
            spans.append((t, t + dur))
            t += dur
        if spans:
            spans[-1] = (spans[-1][0], audio_dur)
        return spans

    spans: list[tuple[float, float]] = []
    cursor = 0
    for words in line_words:
        if not words:
            spans.append((0.0, 0.0))
            continue
        matched_starts: list[float] = []
        matched_ends: list[float] = []
        for w in words:
            found = None
            for j in range(cursor, len(wb_words)):
                if wb_words[j][0] == w or wb_words[j][0].startswith(w[:3]):
                    found = j
                    break
            if found is None:
                continue
            matched_starts.append(wb_words[found][1])
            matched_ends.append(wb_words[found][2])
            cursor = found + 1
        if matched_starts:
            spans.append((matched_starts[0], matched_ends[-1]))
        else:
            spans.append((0.0, 0.0))

    # Preenche gaps vazios / ajusta ao áudio
    last_end = 0.0
    fixed: list[tuple[float, float]] = []
    for i, (s, e) in enumerate(spans):
        if e <= s:
            # estimativa local
            share = max(len(display_lines[i].strip()), 1) / max(
                sum(len(l.strip()) for l in display_lines), 1
            )
            s = last_end
            e = min(audio_dur, s + max(audio_dur * share, 0.12))
        s = max(0.0, min(s, audio_dur))
        e = max(s + 0.05, min(e, audio_dur))
        fixed.append((s, e))
        last_end = e
    if fixed:
        fixed[-1] = (fixed[-1][0], max(fixed[-1][1], audio_dur))
    return fixed


async def _edge_synth_utterance(
    text: str,
    out_path: Path,
    voice: str,
    rate: str,
    pitch: str,
) -> list[dict]:
    import edge_tts

    communicate = edge_tts.Communicate(
        text, voice, rate=rate, pitch=pitch, boundary="WordBoundary"
    )
    audio = bytearray()
    boundaries: list[dict] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        else:
            boundaries.append(chunk)
    out_path.write_bytes(bytes(audio))
    return boundaries


def synthesize_edge_utterances(
    utterances: list[list[str]],
    tone: str,
    work_dir: Path,
) -> tuple[list[Path], list[list[dict]]]:
    profile = VOICE_PROFILES[tone]
    voice = profile["edge_voice"]
    rate = profile["edge_rate"]
    pitch = profile["edge_pitch"]
    paths: list[Path] = []
    all_bounds: list[list[dict]] = []

    async def all_utts() -> None:
        for i, lines in enumerate(utterances):
            clean = clean_tts_text(" ".join(lines))
            out = work_dir / f"tts_u{i:02d}.mp3"
            bounds = await _edge_synth_utterance(clean, out, voice, rate, pitch)
            paths.append(out)
            all_bounds.append(bounds)

    asyncio.run(all_utts())
    return paths, all_bounds


def synthesize_elevenlabs_utterances(
    utterances: list[list[str]],
    tone: str,
    work_dir: Path,
) -> tuple[list[Path], list[list[dict]]]:
    api_key = (os.environ.get("ELEVENLABS_API_KEY") or "").strip()
    profile = VOICE_PROFILES[tone]
    voice_id = (
        os.environ.get(profile["eleven_voice_env"])
        or os.environ.get("ELEVENLABS_VOICE_ID")
        or profile["eleven_voice_default"]
    ).strip()
    model = (os.environ.get("ELEVENLABS_MODEL") or ELEVEN_MODEL).strip()
    paths: list[Path] = []
    # Sem WordBoundary nativo → lista vazia (proporção por chars)
    empty_bounds: list[list[dict]] = []

    for i, lines in enumerate(utterances):
        clean = clean_tts_text(" ".join(lines))
        out = work_dir / f"tts_u{i:02d}.mp3"
        payload = json.dumps(
            {
                "text": clean,
                "model_id": model,
                "voice_settings": {
                    "stability": ELEVEN_STABILITY,
                    "similarity_boost": ELEVEN_SIMILARITY,
                    "style": ELEVEN_STYLE,
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
            with urllib.request.urlopen(req, timeout=90) as resp:
                out.write_bytes(resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"ElevenLabs HTTP {exc.code}: {body}") from exc
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"ElevenLabs falhou: {exc}") from exc
        paths.append(out)
        empty_bounds.append([])
    return paths, empty_bounds


def synthesize_sapi_utterances(
    utterances: list[list[str]],
    tone: str,
    work_dir: Path,
) -> tuple[list[Path], list[list[dict]]]:
    rate = int(VOICE_PROFILES[tone]["sapi_rate"])
    paths: list[Path] = []
    empty_bounds: list[list[dict]] = []
    for i, lines in enumerate(utterances):
        clean = clean_tts_text(" ".join(lines))
        out = work_dir / f"tts_u{i:02d}.wav"
        safe = clean.replace("'", "''")
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
            raise RuntimeError(f"SAPI falhou na fala {i}: {err}")
        paths.append(out)
        empty_bounds.append([])
    return paths, empty_bounds


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


def concat_voice_track_utterances(
    ffmpeg: str,
    ffprobe: str,
    utterance_audios: list[Path],
    utterances: list[list[str]],
    boundaries_per_utt: list[list[dict]],
    work_dir: Path,
    out_path: Path,
    rng: random.Random,
) -> tuple[list[tuple[float, float, str]], float]:
    """
    Monta trilha com lead-in + falas + gaps (150–220ms; 300ms pós-gancho).
    Retorna segments de legenda (texto visual) sync à duração real / WordBoundary.
    """
    durs = [probe_duration(ffprobe, p) for p in utterance_audios]
    lead = work_dir / "silence_lead.wav"
    tail = work_dir / "silence_tail.wav"
    make_silence_wav(ffmpeg, lead, LEAD_IN_SEC)
    make_silence_wav(ffmpeg, tail, TAIL_HOLD_SEC)

    normalized: list[Path] = []
    for i, src in enumerate(utterance_audios):
        dst = work_dir / f"norm_u{i:02d}.wav"
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

    gaps: list[float] = []
    for i in range(len(normalized) - 1):
        gaps.append(gap_after_utterance(i, utterances[i], rng))

    gap_paths: list[Path] = []
    for i, g in enumerate(gaps):
        gp = work_dir / f"silence_gap_{i:02d}.wav"
        make_silence_wav(ffmpeg, gp, g)
        gap_paths.append(gp)

    concat_list = work_dir / "voice_concat.txt"
    parts: list[str] = [f"file '{lead.resolve().as_posix()}'"]
    for i, n in enumerate(normalized):
        parts.append(f"file '{n.resolve().as_posix()}'")
        if i < len(gap_paths):
            parts.append(f"file '{gap_paths[i].resolve().as_posix()}'")
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

    # Timeline de legendas a partir de WordBoundary / duração real
    segments: list[tuple[float, float, str]] = []
    t_cursor = LEAD_IN_SEC
    for i, (lines, dur, bounds) in enumerate(
        zip(utterances, durs, boundaries_per_utt)
    ):
        local_spans = map_lines_from_word_boundaries(lines, bounds, dur)
        for line, (ls, le) in zip(lines, local_spans):
            segments.append((t_cursor + ls, t_cursor + le, line))
        t_cursor += dur
        if i < len(gaps):
            t_cursor += gaps[i]

    real = probe_duration(ffprobe, out_path)
    total = max(t_cursor + TAIL_HOLD_SEC, real)
    return segments, total


def synthesize_narration(
    engine: str,
    lines: list[str],
    tone: str,
    ffmpeg: str,
    ffprobe: str,
    work_dir: Path,
    rng: random.Random,
) -> tuple[Path | None, list[tuple[float, float, str]], float, str]:
    if engine == "none":
        segments, duration = build_timeline_estimated(lines)
        return None, segments, duration, "sem voz (timeline estimada)"

    utterances = group_utterances(lines)
    try:
        if engine == "edge":
            audios, bounds = synthesize_edge_utterances(utterances, tone, work_dir)
            detail = (
                f"edge-tts {VOICE_PROFILES[tone]['edge_voice']} "
                f"rate={VOICE_PROFILES[tone]['edge_rate']} "
                f"pitch={VOICE_PROFILES[tone]['edge_pitch']} "
                f"tone={tone} WordBoundary utts={len(utterances)}"
            )
        elif engine == "elevenlabs":
            audios, bounds = synthesize_elevenlabs_utterances(
                utterances, tone, work_dir
            )
            detail = (
                f"ElevenLabs {ELEVEN_MODEL} "
                f"stab={ELEVEN_STABILITY} sim={ELEVEN_SIMILARITY} "
                f"style={ELEVEN_STYLE} tone={tone} utts={len(utterances)}"
            )
        elif engine == "sapi":
            audios, bounds = synthesize_sapi_utterances(utterances, tone, work_dir)
            detail = (
                f"Windows SAPI rate={VOICE_PROFILES[tone]['sapi_rate']} "
                f"tone={tone} utts={len(utterances)}"
            )
        else:
            segments, duration = build_timeline_estimated(lines)
            return None, segments, duration, f"engine desconhecido ({engine})"

        voice_path = work_dir / "voice_track.wav"
        segments, duration = concat_voice_track_utterances(
            ffmpeg,
            ffprobe,
            audios,
            utterances,
            bounds,
            work_dir,
            voice_path,
            rng,
        )
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
    rng: random.Random,
) -> tuple[Path, dict]:
    card = CARDS_DIR / arch["card"]
    if not card.exists():
        raise SystemExit(f"Carta não encontrada: {card}")

    palette = extract_palette(card)
    print(
        f"  palette base={palette['base']} accent={palette['accent']} "
        f"text={palette['text']} contrast={palette['contrast']} "
        f"panel_a={palette['panel_alpha']}"
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
        rng,
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
        palette["text"],
        palette["accent"],
        palette["base"],
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
    load_env_files()
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
        help="Motor de voz (auto: ElevenLabs se chave; senão edge-tts)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Seed para gaps 150–220ms")
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
    rng = random.Random(args.seed)

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
                ffmpeg, ffprobe, arch, out_dir, work, engine, rng
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
    durations: list[float] = []
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
            durations.append(d)
            w, h = stream.get("width"), stream.get("height")
            fps = stream.get("r_frame_rate")
            print(
                f"OK {mp4.name}\t{mp4.stat().st_size:>10} bytes\t{d:.2f}s\t"
                f"{w}x{h}\t{fps}"
            )
            if w != WIDTH or h != HEIGHT:
                errors.append(f"resolução errada: {mp4.name} {w}x{h}")
            if fps not in ("30/1", "30"):
                if fps != "30/1":
                    errors.append(f"fps inesperado: {mp4.name} {fps}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"não abre: {mp4} ({exc})")

    if errors:
        raise SystemExit("\n".join(errors))

    if not args.only and len(expected) != 12:
        raise SystemExit("Esperava 12 arquétipos")

    avg_dur = sum(durations) / len(durations) if durations else 0.0

    print("\n--- Paletas / TTS ---")
    for path, size, dur, palette, _stream in results:
        print(
            f"{path.name}: base={palette['base']} accent={palette['accent']} "
            f"text={palette['text']} contrast={palette['contrast']} "
            f"voice={palette.get('has_voice')} | {palette.get('tts')}"
        )

    print(f"\nConcluído: {len(expected)} vídeo(s) em {out_dir}")
    print(f"Engine: {engine} — {engine_note}")
    print(f"Average duration: {avg_dur:.2f}s")
    print(f"Approach: {results[0][3]['approach'] if results else 'n/a'}")


if __name__ == "__main__":
    main()
