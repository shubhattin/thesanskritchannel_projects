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
MAP_PATH = BASE_DIR / "rgveda_map.json"


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
_SHLOKA_MARKER_RE = re.compile(r"॥\s*[०-९]+\s*॥")

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


def _format_shloka_text(txt: str) -> str:
    """
    Format one shloka-unit for consistent display/grouping.

    Rules:
    - Insert a newline after a single virAma `।` (danda) so each half-line becomes its own line
      *within the same shloka text*.

    Notes:
    - We intentionally do not touch `:` since it is used as halant in some sources.
    """
    # Normalize newlines first.
    txt = txt.replace("\r\n", "\n").replace("\r", "\n")

    # Flatten existing line breaks within a shloka into spaces.
    txt = re.sub(r"[ \t]*\n[ \t]*", " ", txt)
    txt = re.sub(r"[ \t]+", " ", txt)

    # Add a newline after single danda. Consume optional whitespace after danda to avoid dangling
    # spaces at the start of the next line.
    txt = re.sub(r"।[ \t]*", "।\n", txt)

    # Trim spaces around each half-line.
    return "\n".join(ln.strip() for ln in txt.splitlines()).strip()


def parse_txt_to_shloka_list(txt: str) -> list[dict]:
    """
    Parse one .txt file into a list of {text,index,shloka_num}.

    Rigveda text_data files typically have:
    - A first "metadata" line (rishi/devata/chandas) which should remain as a single record
      with shloka_num = null.
    - Following content that should be grouped into shloka units, where a shloka ends when
      we encounter a pUrnA-virAma-with-number closing marker like `॥१॥`.

    Within each shloka text, a newline is inserted after `।` to keep the two pAdas separated
    while still remaining in the same shloka record.
    """
    txt = txt.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in txt.splitlines() if ln.strip()]
    if not lines:
        return []

    out: list[dict] = []

    # 1) Keep the first line as-is (do not split/group it by danda).
    out.append({"text": lines[0], "index": 0, "shloka_num": None})

    body = "\n".join(lines[1:]).strip()
    if not body:
        return out

    # 2) Group remaining content by the `॥<dev-digits>॥` closing marker.
    last_end = 0
    idx = 1
    for m in _SHLOKA_MARKER_RE.finditer(body):
        chunk = body[last_end : m.end()].strip()
        last_end = m.end()
        if not chunk:
            continue

        formatted = _format_shloka_text(chunk)
        shloka_num: Optional[int] = None
        num_m = _SHLOKA_NUM_RE.search(formatted)
        if num_m:
            shloka_num = _dev_digits_to_int(num_m.group(1))

        out.append({"text": formatted, "index": idx, "shloka_num": shloka_num})
        idx += 1

    # Any trailing text after the last marker (rare) is kept as a final record.
    tail = body[last_end:].strip()
    if tail:
        formatted = _format_shloka_text(tail)
        shloka_num: Optional[int] = None
        num_m = _SHLOKA_NUM_RE.search(formatted)
        if num_m:
            shloka_num = _dev_digits_to_int(num_m.group(1))
        out.append({"text": formatted, "index": idx, "shloka_num": shloka_num})

    return out


def _to_dev_digits(num: int) -> str:
    return str(num).translate(_LATIN_TO_DEV)


def _count_shlokas(records: list[dict]) -> int:
    return sum(1 for r in records if r.get("shloka_num") is not None)


def _safe_int_from_stem(p: Path) -> int:
    try:
        return int(p.stem)
    except Exception:
        return -1


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


def _update_rgveda_map(
    *,
    mandala_to_sukta_meta: dict[int, dict[int, tuple[int, int]]],
    list_count_expected: Optional[int] = None,
) -> None:
    """
    Updates rgveda_map.json in-place (new recursive TS schema):

      root(list_name=Shakha)
        -> shAkala (list_name=Bhaga)
          -> shAkalaSangHita (list_name=Mandala)
            -> mandalas (list_name=Sukta)
              -> suktas (type=shloka)

    mandala_to_sukta_meta: { mandala_num: { sukta_num: (shloka_count, total) } }
    """
    if not MAP_PATH.exists():
        console.print(f"[yellow]Map file not found, skipping: {MAP_PATH}[/]")
        return

    data = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("list"), list):
        console.print(f"[yellow]Unexpected map format, skipping: {MAP_PATH}[/]")
        return

    def _find_child(items: list, *, name_nor: str) -> Optional[dict]:
        for it in items:
            if isinstance(it, dict) and it.get("name_nor") == name_nor:
                return it
        return None

    shakha_list = data.get("list") or []
    shakha = _find_child(shakha_list, name_nor="shAkala") or (
        shakha_list[0] if shakha_list and isinstance(shakha_list[0], dict) else None
    )
    if not isinstance(shakha, dict):
        console.print("[yellow]Could not find shakha node in map; skipping[/]")
        return

    bhaga_list = shakha.get("list") or []
    target = _find_child(bhaga_list, name_nor="shAkalaSangHita")
    if not isinstance(target, dict):
        console.print("[yellow]Could not find shAkalaSangHita entry in map; skipping[/]")
        return

    info = target.get("info") or {}
    if not isinstance(info, dict) or info.get("type") != "list":
        console.print("[yellow]shAkalaSangHita node has unexpected info; skipping[/]")
        return

    mandala_count = int(info.get("list_count") or 0)
    if mandala_count <= 0:
        # fallback to max observed mandala
        mandala_count = max(mandala_to_sukta_meta.keys(), default=0)
    if list_count_expected is not None:
        info["list_count_expected"] = list_count_expected

    mandala_items: list[dict] = []
    for mandala_num in range(1, mandala_count + 1):
        sukta_meta = mandala_to_sukta_meta.get(mandala_num, {})
        sukta_nums = sorted([n for n in sukta_meta.keys() if n > 0])

        sukta_items: list[dict] = []
        for sukta_num in sukta_nums:
            shloka_count, total = sukta_meta[sukta_num]
            sukta_items.append(
                {
                    "name_dev": f"सूक्त {_to_dev_digits(sukta_num)}",
                    "name_nor": f"sUkta {sukta_num}",
                    "pos": sukta_num,
                    "info": {
                        "type": "shloka",
                        "shloka_count": int(shloka_count),
                        "total": int(total),
                    },
                    "list": [],
                }
            )

        mandala_items.append(
            {
                "name_dev": f"मण्डल {_to_dev_digits(mandala_num)}",
                "name_nor": f"maNDala {mandala_num}",
                "pos": mandala_num,
                "info": {
                    "type": "list",
                    "list_name": "Sukta",
                    "list_count": len(sukta_items),
                },
                "list": sukta_items,
            }
        )

    info["list_name"] = info.get("list_name") or "Mandala"
    info["list_count"] = len(mandala_items)
    target["info"] = info
    target["list"] = mandala_items
    MAP_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


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
    _ = force  # retained for CLI compatibility; no skip logic

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

    # mandala -> sukta -> (shloka_count, total)
    mandala_to_sukta_meta: dict[int, dict[int, tuple[int, int]]] = {}

    for p in txt_files:
        # Compute stats for map while generating json.
        txt = p.read_text(encoding="utf-8", errors="replace")
        records = parse_txt_to_shloka_list(txt)
        shloka_count = _count_shlokas(records)
        total = len(records)

        # Expected hierarchy: <shakha>/<samhita>/<mandala>/<sukta>.txt
        rel = p.relative_to(text_root)
        parts = rel.parts
        if len(parts) >= 4:
            mandala_num = _safe_int_from_stem(Path(parts[-2]))
            sukta_num = _safe_int_from_stem(p)
            if mandala_num > 0 and sukta_num > 0:
                mandala_to_sukta_meta.setdefault(mandala_num, {})[sukta_num] = (
                    shloka_count,
                    total,
                )

        out_path = _output_json_path(p)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        wrote += 1

    # Update rgveda_map.json after generation.
    if mandala_to_sukta_meta:
        _update_rgveda_map(mandala_to_sukta_meta=mandala_to_sukta_meta)

    console.print(f"[green]Done.[/] wrote={wrote}")


if __name__ == "__main__":
    app()
