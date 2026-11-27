#!/usr/bin/env python3
"""
Gera 36 vídeos TikTok curtos (9:16) — 12 arquétipos × 3 · carta + música, SEM TTS.

Estilo idêntico a generate-tiktok-positivos-5.py / amostra-estilo-anterior.
Fluxo: forças → “Isso é o arquétipo do X” → CTA quiz. Toda legenda no TOPO.

Uso:
  python scripts/generate-tiktok-positivos-36.py
  python scripts/generate-tiktok-positivos-36.py --only 1,2,3
  python scripts/generate-tiktok-positivos-36.py --dry-run
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

_POS5_PATH = SCRIPT_DIR / "generate-tiktok-positivos-5.py"
_spec = importlib.util.spec_from_file_location("positivos5", _POS5_PATH)
if _spec is None or _spec.loader is None:
    raise SystemExit(f"Não carreguei {_POS5_PATH}")
p5 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(p5)

DEFAULT_ROTEIROS = REPO_ROOT / "ROTEIROS_36_POSITIVOS.md"
DEFAULT_OUT_DIR = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\videos-36-positivos-12dias"
)
TEMP_ROOT = Path(r"D:\tiktok-temp")
EXPECTED_COUNT = 36
DEFAULT_DURATION = 14.0

# index 1–36 → DiaNN-Nome-VV.mp4 (ASCII-safe)
OUT_NAMES: dict[int, str] = {
    1: "Dia01-Inocente-V1.mp4",
    2: "Dia01-Inocente-V2.mp4",
    3: "Dia01-Inocente-V3.mp4",
    4: "Dia02-Orfao-V1.mp4",
    5: "Dia02-Orfao-V2.mp4",
    6: "Dia02-Orfao-V3.mp4",
    7: "Dia03-Heroi-V1.mp4",
    8: "Dia03-Heroi-V2.mp4",
    9: "Dia03-Heroi-V3.mp4",
    10: "Dia04-Cuidador-V1.mp4",
    11: "Dia04-Cuidador-V2.mp4",
    12: "Dia04-Cuidador-V3.mp4",
    13: "Dia05-Explorador-V1.mp4",
    14: "Dia05-Explorador-V2.mp4",
    15: "Dia05-Explorador-V3.mp4",
    16: "Dia06-Rebelde-V1.mp4",
    17: "Dia06-Rebelde-V2.mp4",
    18: "Dia06-Rebelde-V3.mp4",
    19: "Dia07-Amante-V1.mp4",
    20: "Dia07-Amante-V2.mp4",
    21: "Dia07-Amante-V3.mp4",
    22: "Dia08-Criador-V1.mp4",
    23: "Dia08-Criador-V2.mp4",
    24: "Dia08-Criador-V3.mp4",
    25: "Dia09-Bobo-V1.mp4",
    26: "Dia09-Bobo-V2.mp4",
    27: "Dia09-Bobo-V3.mp4",
    28: "Dia10-Sabio-V1.mp4",
    29: "Dia10-Sabio-V2.mp4",
    30: "Dia10-Sabio-V3.mp4",
    31: "Dia11-Mago-V1.mp4",
    32: "Dia11-Mago-V2.mp4",
    33: "Dia11-Mago-V3.mp4",
    34: "Dia12-Governante-V1.mp4",
    35: "Dia12-Governante-V2.mp4",
    36: "Dia12-Governante-V3.mp4",
}


def parse_roteiros_36(path: Path) -> list[p5.PositivoSpec]:
    if not path.is_file():
        raise SystemExit(f"Roteiros não encontrados: {path}")

    text = path.read_text(encoding="utf-8")
    section_re = re.compile(
        r"## (\d+)\.\s*Carta / Arquétipo \(ref\. interna\):\s*([^·]+)·\s*`([a-z0-9_]+\.jpg)`\s*\n(.*?)(?=\n## \d+\. |\n## Checklist|\Z)",
        re.DOTALL | re.IGNORECASE,
    )
    specs: list[p5.PositivoSpec] = []
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
            else p5.default_reveal(slug_from_card)
        )

        cta_m = re.search(r"-\s*\*\*CTA:\*\*\s*(.+)", body)
        cta_raw = cta_m.group(1).strip() if cta_m else p5.CTA_PHRASE
        if "teste completo" not in cta_raw.lower() and "link da bio" not in cta_raw.lower():
            raise SystemExit(f"CTA fora do padrão no vídeo {index}: {cta_raw[:80]}")

        out_name = OUT_NAMES.get(index)
        if not out_name:
            raise SystemExit(f"Sem out_name para índice {index}")
        # Prefer filename from MD if present
        file_m = re.search(r"`(Dia\d{2}-[A-Za-z]+-V[123]\.mp4)`", body)
        if file_m:
            out_name = file_m.group(1)

        specs.append(
            p5.PositivoSpec(
                index=index,
                card=m.group(3).lower(),
                slug=slug_from_card,
                punch=punch,
                lines=lines,
                reveal=reveal,
                cta=p5.CTA_SCREEN,
                out_name=out_name,
            )
        )

    if len(specs) != EXPECTED_COUNT:
        raise SystemExit(
            f"Esperado {EXPECTED_COUNT} seções no MD; parse achou {len(specs)}"
        )
    specs.sort(key=lambda s: s.index)
    return specs


def render_one_36(
    *,
    spec: p5.PositivoSpec,
    duration: float,
    out_path: Path,
    work_root: Path,
    total: int,
) -> Path:
    """Igual a p5.render_one, com contador N/36 no log."""
    card = p5.CARDS_DIR / spec.card
    if not card.is_file():
        raise SystemExit(f"Carta não encontrada: {card}")
    if not p5.AUDIO_PATH.is_file():
        raise SystemExit(f"Trilha não encontrada: {p5.AUDIO_PATH}")

    # Monkey-patch label print via wrapping: call original after announcing
    print(
        f"[{spec.index}/{total}] {spec.out_name}  card={spec.card}  "
        f"reveal={spec.reveal!r}"
    )
    return p5.render_one(
        spec=spec,
        duration=duration,
        out_path=out_path,
        work_root=work_root,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch 36 TikTok positivos (12 dias × 3)"
    )
    parser.add_argument(
        "--roteiros",
        type=Path,
        default=DEFAULT_ROTEIROS,
        help="Markdown de roteiros 36 positivos",
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
        help="Duração em segundos (8–16; default 14)",
    )
    parser.add_argument(
        "--only",
        default="",
        help="Índices 1–36 separados por vírgula (ex: 1,2,3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Só lista specs, não renderiza",
    )
    args = parser.parse_args()

    dur = max(8.0, min(16.0, float(args.duration)))
    specs = parse_roteiros_36(args.roteiros.resolve())
    if args.only.strip():
        wanted = {int(x.strip()) for x in args.only.split(",") if x.strip()}
        specs = [s for s in specs if s.index in wanted]
        if not specs:
            raise SystemExit(f"--only sem match: {args.only}")

    out_dir = args.out_dir.resolve()
    # Não tocar pastas de outras levas
    forbidden = {
        "videos-carta-musica-30",
        "videos-cartas36-30",
        "videos-positivos-5",
    }
    if out_dir.name.lower() in forbidden:
        raise SystemExit(f"Recusado: out-dir não pode ser {out_dir.name}")

    font_name, fonts_dir = p5.pick_positivo_font(
        work_root=TEMP_ROOT / "positivos-36"
    )
    print(f"roteiros={args.roteiros}")
    print(f"out={out_dir}  duration={dur:.1f}s  n={len(specs)}")
    print(
        f"trilha={p5.AUDIO_PATH.name}  vol={p5.MUSIC_VOLUME}  TTS=off  reveal=ON"
    )
    print(
        f"font={font_name!r}  fontsdir={fonts_dir}  "
        f"Fontsize Punch={p5.PUNCH_FONT} Hook={p5.HOOK_FONT} "
        f"Reveal={p5.REVEAL_FONT} CTA={p5.CTA_FONT}"
    )

    if args.dry_run:
        for s in specs:
            print(f"  {s.index}. {s.out_name}  card={s.card}")
            print(f"     punch: {s.punch}")
            print(f"     lines: {' / '.join(s.lines)}")
            print(f"     reveal: {s.reveal}")
            print(f"     cta: {p5.CTA_PHRASE} · link da bio")
        return

    TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    work_root = TEMP_ROOT / "positivos-36"
    work_root.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    editado = out_dir.parent
    dest_md = editado / "ROTEIROS_36_POSITIVOS.md"
    src_md = args.roteiros.resolve()
    if src_md.is_file():
        dest_md.write_text(src_md.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"roteiros→ {dest_md}")

    done: list[Path] = []
    total = len(specs)
    for spec in specs:
        out_path = out_dir / spec.out_name
        done.append(
            render_one_36(
                spec=spec,
                duration=dur,
                out_path=out_path,
                work_root=work_root,
                total=EXPECTED_COUNT,
            )
        )
        print(f"  progresso {len(done)}/{total}")

    print(f"\nPronto: {len(done)}/{EXPECTED_COUNT} vídeos em {out_dir}")
    missing = [OUT_NAMES[i] for i in range(1, 37) if not (out_dir / OUT_NAMES[i]).is_file()]
    if missing and not args.only.strip():
        print(f"FALTANDO ({len(missing)}): {', '.join(missing)}", file=sys.stderr)
        raise SystemExit(1)
    for p in done:
        print(f"  - {p.name}  {p.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
