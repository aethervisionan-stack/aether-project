#!/usr/bin/env python3
"""
Gera 30 vídeos TikTok (9:16) a partir dos roteiros Dia01-Video1 … Dia10-Video3.

Reusa o pipeline de generate-tiktok-archetype-videos.py (TTS, ASS, zoom, mix).
Regra: NÃO mostra nome de arquétipo no título/tela (usa Texto na Tela do roteiro).

Uso:
  python scripts/generate-tiktok-10-dias-videos.py
  python scripts/generate-tiktok-10-dias-videos.py --only Dia01-Video1 Dia10-Video3
  python scripts/generate-tiktok-10-dias-videos.py --engine edge
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import random
import re
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BASE_SCRIPT = REPO_ROOT / "scripts" / "generate-tiktok-archetype-videos.py"

ROTEIROS_DIR = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\roteiros-tiktok-10-dias"
)
DEFAULT_OUT = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\videos-tiktok-10-dias"
)

# Fallback de carta quando o MD não cita .jpg (dias 5–10 / eixos / oferta)
CARD_FALLBACK: dict[str, str] = {
    "Dia01-Video1": "inocente.jpg",
    "Dia01-Video2": "pessoa_comum.jpg",
    "Dia01-Video3": "heroi.jpg",
    "Dia02-Video1": "cuidador.jpg",
    "Dia02-Video2": "explorador.jpg",
    "Dia02-Video3": "rebelde.jpg",
    "Dia03-Video1": "amante.jpg",
    "Dia03-Video2": "criador.jpg",
    "Dia03-Video3": "bobo_da_corte.jpg",
    "Dia04-Video1": "sabio.jpg",
    "Dia04-Video2": "mago.jpg",
    "Dia04-Video3": "governante.jpg",
    "Dia05-Video1": "heroi.jpg",
    "Dia05-Video2": "governante.jpg",
    "Dia05-Video3": "amante.jpg",
    "Dia06-Video1": "criador.jpg",
    "Dia06-Video2": "mago.jpg",
    "Dia06-Video3": "inocente.jpg",
    "Dia07-Video1": "inocente.jpg",
    "Dia07-Video2": "heroi.jpg",
    "Dia07-Video3": "rebelde.jpg",
    "Dia08-Video1": "amante.jpg",
    "Dia08-Video2": "criador.jpg",
    "Dia08-Video3": "sabio.jpg",
    "Dia09-Video1": "pessoa_comum.jpg",
    "Dia09-Video2": "explorador.jpg",
    "Dia09-Video3": "mago.jpg",
    "Dia10-Video1": "mago.jpg",
    "Dia10-Video2": "governante.jpg",
    "Dia10-Video3": "governante.jpg",
}

CARD_TO_TONE = {
    "inocente.jpg": "leve",
    "pessoa_comum.jpg": "leve",
    "heroi.jpg": "firme",
    "cuidador.jpg": "intenso",
    "explorador.jpg": "leve",
    "rebelde.jpg": "intenso",
    "amante.jpg": "intenso",
    "criador.jpg": "intenso",
    "bobo_da_corte.jpg": "leve",
    "sabio.jpg": "firme",
    "mago.jpg": "firme",
    "governante.jpg": "firme",
}

# Palavras de acento SEM nomes de arquétipo (regra TikTok)
SAFE_ACCENT_WORDS = [
    "sombra",
    "carta",
    "dossiê",
    "quiz",
    "bio",
    "diagnóstico",
    "perfil",
    "padrão",
    "espelho",
    "véu",
    "selo",
    "trono",
    "máscara",
    "legado",
    "confluência",
    "integração",
    "mentor",
    "combo",
    "R$ 1",
    "R$ 5",
    "R$ 6",
    "R$ 1,00",
    "R$ 5,00",
    "R$ 6,00",
]


def load_pipeline():
    spec = importlib.util.spec_from_file_location("tiktok_pipeline", BASE_SCRIPT)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Não carreguei {BASE_SCRIPT}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["tiktok_pipeline"] = mod
    spec.loader.exec_module(mod)
    # Sobrescreve keywords de acento para não destacar nomes de arquétipo
    mod.ACCENT_WORDS = SAFE_ACCENT_WORDS
    return mod


def field(text: str, label: str) -> str:
    # Em-dash / en-dash variants in "0–3s"
    pat = rf"\*\*{re.escape(label)}\*\*\s*(.+?)(?=\n- \*\*|\n###|\n---|\Z)"
    m = re.search(pat, text, re.DOTALL)
    if not m:
        # try with flexible dash in time labels already in label
        return ""
    return re.sub(r"\s+", " ", m.group(1).strip())


def parse_roteiro(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    slug = path.stem  # Dia01-Video1

    def grab(prefix: str) -> str:
        # Match **Prefix:** rest of line (or until next bullet)
        m = re.search(
            rf"\*\*{re.escape(prefix)}:\*\*\s*(.+?)(?=\n\s*-\s*\*\*|\n###|\n---|\Z)",
            raw,
            re.DOTALL,
        )
        if not m:
            return ""
        return re.sub(r"\s+", " ", m.group(1).strip())

    tela = grab("Texto na Tela (0–3s)")
    if not tela:
        tela = grab("Texto na Tela (0-3s)")
    gancho = grab("Gancho Falado (0–3s)") or grab("Gancho Falado (0-3s)")
    desenvolvimento = grab("Roteiro / Desenvolvimento (3s–25s)") or grab(
        "Roteiro / Desenvolvimento (3s-25s)"
    )
    cta = grab("CTA para o Quiz")
    visual = grab("Sugestão Visual / Clipe")

    cards = re.findall(r"`([a-z0-9_]+\.jpg)`", raw)
    # also bare `amante`/`sabio` without .jpg
    bare = re.findall(r"`([a-z0-9_]+)`", raw)
    for b in bare:
        if b.endswith(".jpg"):
            continue
        cand = f"{b}.jpg"
        if cand not in cards and (REPO_ROOT / "public" / "images" / "archetypes" / cand).is_file():
            cards.append(cand)

    card = cards[0] if cards else CARD_FALLBACK.get(slug, "mago.jpg")
    if not tela:
        tela = "Sua carta… espera"
    return {
        "slug": slug,
        "title": tela,  # título na tela = gancho visual, NÃO nome de arquétipo
        "card": card,
        "tone": CARD_TO_TONE.get(card, "leve"),
        "tela": tela,
        "gancho": gancho,
        "desenvolvimento": desenvolvimento,
        "cta": cta,
        "visual": visual,
    }


def split_caption_lines(text: str, max_chars: int = 28) -> list[str]:
    """Quebra narração em frases curtas (respiração TTS + sync de legenda)."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    # Split por pontuação + vírgulas longas (respiração humana)
    parts = re.split(r"(?<=[\.\!\?…])\s+|(?<=[;—–])\s+|(?<=,)\s+(?=[A-ZÁÉÍÓÚÀÃÕÂÊÔ])", text)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) <= max_chars:
            chunks.append(part)
            continue
        words = part.split()
        buf: list[str] = []
        for w in words:
            trial = (" ".join(buf + [w])).strip()
            if buf and len(trial) > max_chars:
                chunks.append(" ".join(buf))
                buf = [w]
            else:
                buf.append(w)
        if buf:
            chunks.append(" ".join(buf))
    # Não fundir demais — frases curtas soam mais humanas no edge-tts
    merged: list[str] = []
    for c in chunks:
        if merged and len(c) < 8 and len(merged[-1]) + 1 + len(c) <= max_chars:
            merged[-1] = f"{merged[-1]} {c}"
        else:
            merged.append(c)
    return merged


def build_lines(script: dict) -> list[str]:
    """Gancho + desenvolvimento + CTA → frases curtas (karaoke WordBoundary no pipeline)."""
    parts: list[str] = []
    if script["gancho"]:
        parts.extend(split_caption_lines(script["gancho"], max_chars=30))
    if script["desenvolvimento"]:
        parts.extend(split_caption_lines(script["desenvolvimento"], max_chars=28))
    if script["cta"]:
        parts.extend(split_caption_lines(script["cta"], max_chars=30))
    if not parts:
        parts = [script["title"], "Link na bio. Faça o quiz."]
    return parts


def discover_roteiros(roteiros_dir: Path) -> list[Path]:
    files = sorted(roteiros_dir.glob("Dia*-Video*.md"))
    if len(files) != 30:
        print(f"AVISO: esperava 30 roteiros, achei {len(files)} em {roteiros_dir}")
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera 30 vídeos TikTok dos roteiros 10 dias")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--only", nargs="*", help="Ex.: Dia01-Video1 Dia10-Video3")
    parser.add_argument(
        "--engine",
        choices=["auto", "edge", "elevenlabs", "sapi", "none"],
        default="edge",
        help="Motor TTS (default: edge)",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--roteiros",
        type=Path,
        default=ROTEIROS_DIR,
        help="Pasta com DiaXX-VideoY.md",
    )
    args = parser.parse_args()

    pipe = load_pipeline()
    pipe.load_env_files()

    ffmpeg = pipe.find_ffmpeg()
    ffprobe = pipe.find_ffprobe()
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    roteiros_dir: Path = args.roteiros
    paths = discover_roteiros(roteiros_dir)
    scripts = [parse_roteiro(p) for p in paths]

    if args.only:
        wanted = set(args.only)
        scripts = [s for s in scripts if s["slug"] in wanted]
        missing = wanted - {s["slug"] for s in scripts}
        if missing:
            raise SystemExit(f"Slugs não encontrados: {sorted(missing)}")

    engine, engine_note = pipe.resolve_engine(args.engine)
    rng = random.Random(args.seed)

    print(f"Repo:    {pipe.REPO_ROOT}")
    print(f"Cartas:  {pipe.CARDS_DIR}")
    print(f"Trilha:  {pipe.AUDIO_PATH}")
    print(f"Roteiros:{roteiros_dir}")
    print(f"Saída:   {out_dir}")
    print(f"ffmpeg:  {ffmpeg}")
    print(f"TTS:     {engine} — {engine_note}")
    print(f"Total:   {len(scripts)} vídeo(s)")

    results: list[tuple[Path, float, str]] = []
    failures: list[str] = []

    # Prefer D: temp when C: is tight (rodada anterior)
    temp_root = Path(os.environ.get("TIKTOK_TEMP") or r"D:\tiktok-temp")
    try:
        temp_root.mkdir(parents=True, exist_ok=True)
        work_ctx = tempfile.TemporaryDirectory(prefix="tiktok-10dias-", dir=str(temp_root))
    except OSError:
        work_ctx = tempfile.TemporaryDirectory(prefix="tiktok-10dias-")

    with work_ctx as tmp:
        work = Path(tmp)
        for script in scripts:
            lines = build_lines(script)
            arch = {
                "slug": script["slug"],
                "card": script["card"],
                "title": script["title"],
                "tone": script["tone"],
                "lines": lines,
            }
            print(
                f"\n=== {arch['slug']} card={arch['card']} tone={arch['tone']} "
                f"lines={len(lines)} title={arch['title'][:40]!r} ==="
            )
            try:
                path, palette = pipe.generate_one(
                    ffmpeg, ffprobe, arch, out_dir, work, engine, rng
                )
                dur = pipe.probe_duration(ffprobe, path)
                results.append((path, dur, palette.get("tts", "")))
                print(
                    f"OK {path.name}  {path.stat().st_size/1_000_000:.2f} MB  {dur:.1f}s  "
                    f"voice={palette.get('has_voice')}"
                )
            except Exception as exc:  # noqa: BLE001
                msg = f"FALHOU {script['slug']}: {exc}"
                print(msg)
                failures.append(msg)

    print("\n--- Verificação ---")
    ok = 0
    durations: list[float] = []
    for script in scripts:
        mp4 = out_dir / f"{script['slug']}.mp4"
        if not mp4.is_file() or mp4.stat().st_size < 10_000:
            print(f"FALTANDO {mp4.name}")
            continue
        try:
            meta = pipe.probe_stream(ffprobe, mp4)
            stream = (meta.get("streams") or [{}])[0]
            fmt = meta.get("format") or {}
            d = float(fmt.get("duration") or 0)
            durations.append(d)
            w, h = stream.get("width"), stream.get("height")
            print(
                f"OK {mp4.name}\t{mp4.stat().st_size:>10} bytes\t{d:.2f}s\t{w}x{h}"
            )
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"ERRO {mp4.name}: {exc}")

    avg = sum(durations) / len(durations) if durations else 0.0
    print(f"\nConcluído: {ok}/{len(scripts)} MP4 em {out_dir}")
    print(f"Duração média: {avg:.1f}s")
    if failures:
        print("Falhas:")
        for f in failures:
            print(" -", f)
        raise SystemExit(1)
    if ok < len(scripts):
        raise SystemExit(f"Esperava {len(scripts)} vídeos, tenho {ok}")


if __name__ == "__main__":
    main()
