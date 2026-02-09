#!/usr/bin/env python3

"""
Extract plain text from downloaded Rigveda HTML pages.

Input hierarchy:
  raw_data/<...>/*.html

Output hierarchy (mirrors raw_data):
  text_data/<...>/*.txt

This script is intentionally offline-only (no downloading).
"""

from __future__ import annotations

import html as _html
import re
from pathlib import Path
from typing import Optional

import typer
from pyquery import PyQuery
from rich.console import Console

app = typer.Typer(add_completion=False)
console = Console()


VEDIC_SVARAS = ["॒", "॑", "᳚", "᳛"]
VISARGA = "ः"

RGVEDA_SUBPATH_FILTER = "1"
BASE_DIR = Path(__file__ + "/../..").resolve().parent
RAW_DATA_FOLDER = str(BASE_DIR / "raw_data" / RGVEDA_SUBPATH_FILTER)
OUTPUT_TEXT_FOLDER = str(BASE_DIR / "text_data" / RGVEDA_SUBPATH_FILTER)


_BR_RE = re.compile(r"<\s*br\s*/?\s*>", flags=re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"[ \t\u00A0]+")


def _read_text(path: Path) -> str:
    # Read bytes to be resilient to occasional encoding weirdness.
    return path.read_bytes().decode("utf-8", errors="replace")


def _extract_videotext_fragment(doc: PyQuery) -> Optional[str]:
    """
    Primary target is div#videotext (used by vedicheritage.gov.in pages).
    Returns the element inner HTML (so we can preserve <br> line breaks).
    """
    node = doc("#videotext")
    if node and len(node) > 0:
        return str(node.html() or "")

    # Fallbacks (kept conservative).
    node = doc("div[id='videotext']")
    if node and len(node) > 0:
        return str(node.html() or "")

    node = doc("div.fnt-shobhika-reg")
    if node and len(node) > 0:
        return str(node.html() or "")

    return None


def extract_text_from_html(html_text: str) -> str:
    doc = PyQuery(html_text)
    frag = _extract_videotext_fragment(doc)
    if frag is None:
        return ""

    # Preserve line breaks emitted as <br>.
    frag = _BR_RE.sub("\n", frag)
    # Strip other tags.
    frag = _TAG_RE.sub("", frag)
    # Decode entities like &amp; and &#8211;.
    frag = _html.unescape(frag)

    # Normalize whitespace per line.
    lines: list[str] = []
    for raw_line in frag.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = _SPACE_RE.sub(" ", line)
        lines.append(line)

    return "\n".join(lines).strip() + ("\n" if lines else "")


def _output_txt_path(html_path: Path) -> Path:
    rel = html_path.relative_to(Path(RAW_DATA_FOLDER))
    return Path(OUTPUT_TEXT_FOLDER) / rel.with_suffix(".txt")


def process_one(html_path: Path) -> Path:
    out_path = _output_txt_path(html_path)

    html_text = _read_text(html_path)
    extracted = extract_text_from_html(html_text)
    extracted = re.sub(r"(?=\S)।", " ।", extracted)
    extracted = re.sub(r"(?=\S)॥", " ॥", extracted)
    # Remove number padding
    extracted = re.sub(r"(?<=\d)\s॥", "॥", extracted)
    for vedic_svara in VEDIC_SVARAS:
        extracted = extracted.replace(vedic_svara + ":", VISARGA + vedic_svara)
        # Replacing the incorrect halant usage which might have been there
    REPLACEMENTS = {
        "     ": " ",
        "    ": " ",
        "   ": " ",
        "  ": " ",
        " ": " ",
        ":": VISARGA,
    }
    for k, v in REPLACEMENTS.items():
        extracted = extracted.replace(k, v)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(extracted, encoding="utf-8")
    return out_path


@app.command()
def main(
    force: bool = typer.Option(
        False, "--force", "-f", help="Overwrite existing .txt outputs."
    ),
    raw_folder: str = typer.Option(
        RAW_DATA_FOLDER, "--raw-folder", help="Input folder containing HTML files."
    ),
    out_folder: str = typer.Option(
        OUTPUT_TEXT_FOLDER,
        "--out-folder",
        help="Output folder for extracted .txt files.",
    ),
):
    """
    Walk HTML files under raw_data and extract the Rigveda text into text_data.
    """
    global RAW_DATA_FOLDER, OUTPUT_TEXT_FOLDER
    RAW_DATA_FOLDER = raw_folder
    OUTPUT_TEXT_FOLDER = out_folder

    raw_root = Path(RAW_DATA_FOLDER)
    if not raw_root.is_dir():
        raise typer.Exit(code=2)

    out_root = Path(OUTPUT_TEXT_FOLDER)
    out_root.mkdir(parents=True, exist_ok=True)

    html_files = sorted(raw_root.rglob("*.html"))
    if not html_files:
        console.print(f"[yellow]No .html files found under {RAW_DATA_FOLDER}[/]")
        return

    wrote = 0
    empty = 0
    for p in html_files:
        out_path = process_one(p)
        wrote += 1
        if out_path.stat().st_size == 0:
            empty += 1

    console.print(f"[green]Done.[/] wrote={wrote}, empty_outputs={empty}")


if __name__ == "__main__":
    app()
