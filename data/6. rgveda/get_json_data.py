#!/usr/bin/env python3

"""
Convert extracted Rigveda text files into JSON shloka lists.

Input hierarchy (mirrors raw_data):
  text_data/<...>/*.txt

Output hierarchy:
  data/<...>/*.json

Each output JSON is a list of objects matching `src/state/data_types.ts`:
  { "text": string, "index": int, "shloka_num": number | null }
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

# Matches the common ending marker: ...॥१॥, ...॥ १ ॥ etc.
_SHLOKA_NUM_RE = re.compile(r"॥\s*([०-९]+)\s*॥\s*$")


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


def parse_txt_to_shloka_list(txt: str) -> list[dict]:
    """
    Parse one .txt file into a list of {text,index,shloka_num}.

    - index: 0-based line index after trimming empty lines
    - shloka_num: parsed from a trailing "॥n॥" if present, else null
    """
    lines = [ln.strip() for ln in txt.splitlines()]
    lines = [ln for ln in lines if ln]

    out: list[dict] = []
    for idx, line in enumerate(lines):
        shloka_num: Optional[int] = None
        m = _SHLOKA_NUM_RE.search(line)
        if m:
            shloka_num = _dev_digits_to_int(m.group(1))
        out.append({"text": line, "index": idx, "shloka_num": shloka_num})
    return out


def _output_json_path(txt_path: Path) -> Path:
    rel = txt_path.relative_to(Path(TEXT_DATA_FOLDER))
    return Path(OUTPUT_DATA_FOLDER) / rel.with_suffix(".json")


def process_one(txt_path: Path, *, force: bool) -> tuple[bool, Path]:
    out_path = _output_json_path(txt_path)
    if out_path.exists() and not force and out_path.stat().st_size > 0:
        return (False, out_path)

    txt = txt_path.read_text(encoding="utf-8", errors="replace")
    records = parse_txt_to_shloka_list(txt)

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
