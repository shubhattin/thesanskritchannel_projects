#!/usr/bin/env python3

'"""Extract Shukla-Yajurveda Madhyandina text blocks from HTML."""'

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

SHUKLA_SUBPATH = "2/1/2"
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
RAW_DATA_FOLDER = str(BASE_DIR / "raw_data" / SHUKLA_SUBPATH)
OUTPUT_TEXT_FOLDER = str(BASE_DIR / "text_data" / SHUKLA_SUBPATH)

_BR_RE = re.compile(r"<\s*br\s*/?\s*>", flags=re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"[ \t\u00A0]+")

VEDIC_SVARAS = ["॒", "॑", "᳚", "᳛"]
VISARGA = "ः"


_DEV_TO_INT = {
    "०": 0,
    "१": 1,
    "२": 2,
    "३": 3,
    "४": 4,
    "५": 5,
    "६": 6,
    "७": 7,
    "८": 8,
    "९": 9,
}


def _read_text(path: Path) -> str:
    return path.read_bytes().decode("utf-8", errors="replace")


def _extract_videotext_fragment(doc: PyQuery) -> Optional[str]:
    node = doc("#videotext")
    if node and len(node) > 0:
        return str(node.html() or "")
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
    frag = _BR_RE.sub("\n", frag)
    frag = _TAG_RE.sub("", frag)
    frag = _html.unescape(frag)
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
    extracted = extracted.replace("।।", "॥")
    extracted = re.sub(r"(?=\S)।", " ।", extracted)
    extracted = re.sub(r"(?=\S)॥", " ॥", extracted)
    # Normalize shloka end marker spacing in a robust way:
    #   ॥ २ ॥ / ॥२ ॥ / ॥ २॥ -> ॥२॥
    extracted = re.sub(r"॥\s*([०-९]+)\s*॥", r"॥\1॥", extracted)
    for vedic_svara in VEDIC_SVARAS:
        extracted = extracted.replace(vedic_svara + ":", VISARGA + vedic_svara)
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
    Walk downloaded Shukla-Yajurveda HTML files and extract the video text into text_data.
    """
    global RAW_DATA_FOLDER, OUTPUT_TEXT_FOLDER
    RAW_DATA_FOLDER = raw_folder
    OUTPUT_TEXT_FOLDER = out_folder
    raw_root = Path(RAW_DATA_FOLDER)
    if not raw_root.is_dir():
        console.print(f"[bold red]Missing folder: {RAW_DATA_FOLDER}[/]")
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
