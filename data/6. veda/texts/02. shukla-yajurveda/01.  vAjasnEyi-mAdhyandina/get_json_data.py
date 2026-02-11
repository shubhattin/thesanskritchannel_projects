#!/usr/bin/env python3

"""
Convert extracted Shukla-Yajurveda Madhyandina text files into JSON shloka lists.

Input hierarchy:
  text_data/2/1/2/*.txt

Output hierarchy:
  data/2/1/2/*.json

Also updates veda_map.json for:
  shuklayajurvEdaH -> saMhitA -> mAdhyandina-vAjasanEyI
with an Adhyaya list.
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

SHUKLA_SUBPATH = "2/1/2"
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
TEXT_DATA_FOLDER = str(BASE_DIR / "text_data" / SHUKLA_SUBPATH)
OUTPUT_DATA_FOLDER = str(BASE_DIR / "data" / SHUKLA_SUBPATH)
MAP_PATH = BASE_DIR / "veda_map.json"

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

_LATIN_TO_DEV = str.maketrans(
    {
        "0": "०",
        "1": "१",
        "2": "२",
        "3": "३",
        "4": "४",
        "5": "५",
        "6": "६",
        "7": "७",
        "8": "८",
        "9": "९",
    }
)

# Allow spaced Devanagari digits too, e.g. "॥ १ ० ॥".
_SHLOKA_MARKER_RE = re.compile(r"॥\s*([०-९][०-९\s]*)\s*॥")
_SINGLE_DANDA_RE = re.compile(r"।[ \t]*")


def _to_dev_digits(num: int) -> str:
    return str(num).translate(_LATIN_TO_DEV)


def _safe_int_from_stem(p: Path) -> int:
    try:
        return int(p.stem)
    except Exception:
        return -1


def _dev_digits_to_int(s: str) -> Optional[int]:
    if not s:
        return None
    cleaned = re.sub(r"\s+", "", s)
    if not cleaned:
        return None
    val = 0
    for ch in cleaned:
        d = _DEV_TO_INT.get(ch)
        if d is None:
            return None
        val = val * 10 + d
    return val


def _format_shloka_text(txt: str) -> str:
    txt = txt.replace("\r\n", "\n").replace("\r", "\n")
    txt = re.sub(r"[ \t]*\n[ \t]*", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = _SINGLE_DANDA_RE.sub("।\n", txt)
    return "\n".join(ln.strip() for ln in txt.splitlines()).strip()


def parse_txt_to_shloka_list(txt: str) -> list[dict]:
    txt = txt.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not txt:
        return []

    out: list[dict] = []
    idx = 1
    last_end = 0

    for m in _SHLOKA_MARKER_RE.finditer(txt):
        chunk = txt[last_end : m.end()].strip()
        last_end = m.end()
        if not chunk:
            continue

        formatted = _format_shloka_text(chunk)
        shloka_num = _dev_digits_to_int(m.group(1))
        out.append({"text": formatted, "index": idx, "shloka_num": shloka_num})
        idx += 1

    tail = txt[last_end:].strip()
    if tail:
        out.append({"text": _format_shloka_text(tail), "index": idx, "shloka_num": None})

    return out


def _count_shlokas(records: list[dict]) -> int:
    return sum(1 for r in records if r.get("shloka_num") is not None)


def _output_json_path(txt_path: Path) -> Path:
    rel = txt_path.relative_to(Path(TEXT_DATA_FOLDER))
    return Path(OUTPUT_DATA_FOLDER) / rel.with_suffix(".json")


def _find_child(items: list, *, name_nor: str) -> Optional[dict]:
    for it in items:
        if isinstance(it, dict) and it.get("name_nor") == name_nor:
            return it
    return None


def _update_shukla_map(*, adhyaya_meta: dict[int, tuple[int, int]]) -> None:
    if not MAP_PATH.exists():
        console.print(f"[yellow]Map file not found, skipping: {MAP_PATH}[/]")
        return

    data = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("list"), list):
        console.print(f"[yellow]Unexpected map format, skipping: {MAP_PATH}[/]")
        return

    veda_root = _find_child(data["list"], name_nor="shuklayajurvEdaH")
    if not isinstance(veda_root, dict):
        console.print("[yellow]Could not find shuklayajurvEdaH node; skipping map update[/]")
        return

    bhaga_list = veda_root.get("list") or []
    samhita_node = _find_child(bhaga_list, name_nor="saMhitA")
    if not isinstance(samhita_node, dict):
        console.print("[yellow]Could not find saMhitA node; skipping map update[/]")
        return

    shakha_list = samhita_node.get("list") or []
    target = _find_child(shakha_list, name_nor="mAdhyandina-vAjasanEyI")
    if not isinstance(target, dict):
        console.print(
            "[yellow]Could not find mAdhyandina-vAjasanEyI node; skipping map update[/]"
        )
        return

    adhyaya_nums = sorted([n for n in adhyaya_meta.keys() if n > 0])
    adhyaya_items: list[dict] = []
    for n in adhyaya_nums:
        shloka_count, total = adhyaya_meta[n]
        adhyaya_items.append(
            {
                "name_dev": f"अध्याय {_to_dev_digits(n)}",
                "name_nor": f"adhyAya {n}",
                "pos": n,
                "info": {
                    "type": "shloka",
                    "shloka_count": int(shloka_count),
                    "total": int(total),
                },
                "list": [],
            }
        )

    info = target.get("info") or {}
    if not isinstance(info, dict):
        info = {}
    info["type"] = "list"
    info["list_name"] = info.get("list_name") or "AdhyAya"
    info["list_count"] = len(adhyaya_items)
    target["info"] = info
    target["list"] = adhyaya_items

    MAP_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


@app.command()
def main(
    force: bool = typer.Option(
        False, "--force", "-f", help="Retained for compatibility; files are always rewritten."
    ),
    text_folder: str = typer.Option(
        TEXT_DATA_FOLDER, "--text-folder", help="Input folder containing .txt files."
    ),
    out_folder: str = typer.Option(
        OUTPUT_DATA_FOLDER,
        "--out-folder",
        help="Output folder for generated .json files.",
    ),
    silent: bool = typer.Option(
        False, "--silent", "-s", help="Suppress console output."
    ),
):
    """
    Walk .txt files under text_data/2/1/2 and generate JSON under data/2/1/2.
    """
    global TEXT_DATA_FOLDER, OUTPUT_DATA_FOLDER
    TEXT_DATA_FOLDER = text_folder
    OUTPUT_DATA_FOLDER = out_folder
    _ = force

    text_root = Path(TEXT_DATA_FOLDER)
    if not text_root.is_dir():
        console.print(f"[bold red]Missing folder: {TEXT_DATA_FOLDER}[/]")
        raise typer.Exit(code=2)

    out_root = Path(OUTPUT_DATA_FOLDER)
    out_root.mkdir(parents=True, exist_ok=True)

    txt_files = sorted(text_root.rglob("*.txt"), key=_safe_int_from_stem)
    if not txt_files:
        console.print(f"[yellow]No .txt files found under {TEXT_DATA_FOLDER}[/]")
        return

    wrote = 0
    adhyaya_meta: dict[int, tuple[int, int]] = {}

    for p in txt_files:
        txt = p.read_text(encoding="utf-8", errors="replace")
        records = parse_txt_to_shloka_list(txt)
        shloka_count = _count_shlokas(records)
        total = len(records)

        adhyaya_num = _safe_int_from_stem(p)
        if adhyaya_num > 0:
            adhyaya_meta[adhyaya_num] = (shloka_count, total)

        out_path = _output_json_path(p)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        wrote += 1

    if adhyaya_meta:
        _update_shukla_map(adhyaya_meta=adhyaya_meta)

    if not silent:
        console.print(f"[green]Done.[/] wrote={wrote}")


if __name__ == "__main__":
    app()
