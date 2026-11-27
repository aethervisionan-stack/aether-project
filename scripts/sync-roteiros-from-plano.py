#!/usr/bin/env python3
"""Sincroniza PLANO_30_VIDEOS_10_DIAS.md → 30 MDs em roteiros-tiktok-10-dias (+ cópia editado)."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PLANO = REPO / "PLANO_30_VIDEOS_10_DIAS.md"
OUT_REPO = REPO / "roteiros-tiktok-10-dias"
OUT_EDIT = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\roteiros-tiktok-10-dias"
)
PLANO_EDIT = Path(
    r"C:\Users\Next\Desktop\projeto quiz medieval\editado\PLANO_30_VIDEOS_10_DIAS.md"
)

PERIOD = {"Manhã": 1, "Tarde": 2, "Noite": 3}
HEADER = """# Pronto para gravar / postar no TikTok
# Regra: NÃO falar o nome do arquétipo na tela, na fala ou no CTA
# Voz única: pt-BR-FranciscaNeural (+0% / +1Hz)
# Fórmula: ferida → carta fechada → CTA quiz

"""

SECTION_RE = re.compile(
    r"^### Dia (\d+) — (Manhã|Tarde|Noite) \(`(Dia\d+-Video\d+)`\)\s*$",
    re.MULTILINE,
)


def main() -> None:
    plano = PLANO.read_text(encoding="utf-8")
    matches = list(SECTION_RE.finditer(plano))
    if len(matches) != 30:
        raise SystemExit(f"Esperava 30 seções, achei {len(matches)}")

    OUT_REPO.mkdir(parents=True, exist_ok=True)
    OUT_EDIT.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    for i, m in enumerate(matches):
        day = int(m.group(1))
        when = m.group(2)
        slug = m.group(3)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(plano)
        section = plano[start:end].strip() + "\n"
        title = f"# Dia {day} — Vídeo {PERIOD[when]} ({when})\n"
        body = HEADER + title + section
        for dest in (OUT_REPO, OUT_EDIT):
            (dest / f"{slug}.md").write_text(body, encoding="utf-8")
        written.append(slug)

    index = (
        "# Índice — 30 roteiros TikTok (10 dias)\n\n"
        "Voz única: FranciscaNeural. Fórmula: ferida → carta → CTA.\n\n"
    )
    for s in written:
        index += f"- [{s}]({s}.md)\n"
    (OUT_REPO / "INDEX.md").write_text(index, encoding="utf-8")
    (OUT_EDIT / "INDEX.md").write_text(index, encoding="utf-8")

    shutil.copy2(PLANO, PLANO_EDIT)
    print(f"OK {len(written)} roteiros → {OUT_REPO} e {OUT_EDIT}")
    print(f"Plano copiado → {PLANO_EDIT}")


if __name__ == "__main__":
    main()
