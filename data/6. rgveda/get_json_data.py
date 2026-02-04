#!/usr/bin/env python3

"""
Convert extracted Rigveda text files into structured JSON.

Input hierarchy (mirrors raw_data):
  text_data/<...>/*.txt

Output hierarchy:
  data/<...>/*.json

This script is intentionally offline-only (no downloading).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console

app = typer.Typer(add_completion=False)
console = Console()

BASE_DIR = Path(__file__).resolve().parent
TEXT_DATA_FOLDER = str(BASE_DIR / "text_data")
OUTPUT_DATA_FOLDER = str(BASE_DIR / "data")


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

_VERSE_NUM_RE = re.compile(r"॥\s*([०-९]+)\s*॥")


def _dev_digits_to_int(s: str) -> Optional[int]:
    if not s:
        return None
    val = 0
    for ch in s:
        d = _DEV_TO_INT.get(ch)
        if d is None:
            return None
        val = val * 10 + d
    return val


def parse_txt_to_records(txt: str) -> list[dict]:
    """
    Convert the text of one sukta page into a JSON-serializable list of records.

    Record shape (kept close to ramayanam style):
      { "text": str, "index": int, "verse_num": int | null, "text_clean": str }
    """
    lines = [ln.strip() for ln in txt.splitlines()]
    lines = [ln for ln in lines if ln]
    records: list[dict] = []

    for idx, line in enumerate(lines):
        verse_num: Optional[int] = None
        text_clean = line

        m = _VERSE_NUM_RE.search(line)
        if m:
            verse_num = _dev_digits_to_int(m.group(1))
            # If the number appears at the end, also provide a cleaned version.
            # We keep original line untouched in `text`.
            if m.end() == len(line):
                text_clean = line[: m.start()].rstrip()

        records.append(
            {
                "text": line,
                "index": idx,
                "verse_num": verse_num,
                "text_clean": text_clean,
            }
        )

    return records


def _output_json_path(txt_path: Path) -> Path:
    rel = txt_path.relative_to(Path(TEXT_DATA_FOLDER))
    return Path(OUTPUT_DATA_FOLDER) / rel.with_suffix(".json")


def process_one(txt_path: Path, *, force: bool) -> tuple[bool, Path]:
    out_path = _output_json_path(txt_path)
    if out_path.exists() and not force and out_path.stat().st_size > 0:
        return (False, out_path)

    txt = txt_path.read_text(encoding="utf-8", errors="replace")
    records = parse_txt_to_records(txt)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return (True, out_path)


@app.command()
def main(
    force: bool = typer.Option(
        False, "--force", "-f", help="Overwrite existing .json outputs."
    ),
    text_folder: str = typer.Option(
        TEXT_DATA_FOLDER, "--text-folder", help="Input folder containing .txt files."
    ),
    out_folder: str = typer.Option(
        OUTPUT_DATA_FOLDER,
        "--out-folder",
        help="Output folder for generated .json files.",
    ),
):
    """
    Walk .txt files under text_data and generate JSON under data/.
    """
    global TEXT_DATA_FOLDER, OUTPUT_DATA_FOLDER
    TEXT_DATA_FOLDER = text_folder
    OUTPUT_DATA_FOLDER = out_folder

    text_root = Path(TEXT_DATA_FOLDER)
    if not text_root.is_dir():
        console.print(f"[bold red]Missing folder: {TEXT_DATA_FOLDER}[/]")
        raise typer.Exit(code=2)

    out_root = Path(OUTPUT_DATA_FOLDER)
    out_root.mkdir(parents=True, exist_ok=True)

    txt_files = sorted(text_root.rglob("*.txt"))
    if not txt_files:
        console.print(f"[yellow]No .txt files found under {TEXT_DATA_FOLDER}[/]")
        return

    wrote = 0
    skipped = 0
    for p in txt_files:
        changed, _ = process_one(p, force=force)
        if changed:
            wrote += 1
        else:
            skipped += 1

    console.print(f"[green]Done.[/] wrote={wrote}, skipped={skipped}")


if __name__ == "__main__":
    app()
