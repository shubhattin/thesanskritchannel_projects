import re

import shubhlipi as sh
from common import (
    DOUBLE_VIRAMA,
    NUMBERS,
    SINGLE_VIRAMA,
    from_dev_numbers,
    in_dev_range,
)


def normalize_line(line: str) -> str:
    line = line.replace("||", DOUBLE_VIRAMA).replace("|", SINGLE_VIRAMA)
    line = re.sub(r"(?<={0}) (?=\d)".format(DOUBLE_VIRAMA), "", line)
    line = re.sub(r"(?<=\d) (?={0})".format(DOUBLE_VIRAMA), "", line)
    line = re.sub(r"(?<=\S)(?={0}\d{0})".format(DOUBLE_VIRAMA), " ", line)
    line = re.sub(r"(?<=\S)(?={0}\d\d{0})".format(DOUBLE_VIRAMA), " ", line)
    line = re.sub(r"(?<=\S)(?={0})".format(SINGLE_VIRAMA), " ", line)
    return line


def prepare_lines(raw_text: str) -> list[str]:
    return (
        raw_text.replace("\r\n", "\n")
        .replace("||", DOUBLE_VIRAMA)
        .replace("|", SINGLE_VIRAMA)
        .split("\n")
    )


def is_sanskrit_line(line: str) -> bool:
    line = line.strip()
    if not line or not in_dev_range(line[0]):
        return False
    if re.search(r"[a-zA-Z]", line):
        return False
    if re.match(r"^तन्त्र\s*[-–]", line):
        return False
    return True


def is_speaker_or_title(line: str) -> bool:
    if line.startswith("अथ ") or line.startswith("इति श्री"):
        return True
    return bool(re.search(r"[उु]वाच", line))


def is_skippable_inline_speaker(line: str) -> bool:
    """श्री … उवाच between padas of the same verse — do not emit as its own entry."""
    return line.strip().startswith("श्री ") and bool(re.search(r"[उु]वाच", line))


def parse_shloka_num(line: str) -> int | None:
    digits = "".join(NUMBERS)
    m = re.search(
        rf"{re.escape(DOUBLE_VIRAMA)}\s*([{digits}]+)\s*{re.escape(DOUBLE_VIRAMA)}",
        line,
    )
    if m:
        return int(from_dev_numbers(m.group(1)))
    return None


def verse_in_progress(pending_first_pada: str, prev_line: str) -> bool:
    return bool(pending_first_pada or prev_line)


def segment_lines(lines: list[str]) -> list[dict]:
    """
    Segment text.txt into shloka units (same order/rules as data.json).
    Each segment has text, shloka_num, first_line, last_line (0-based line indices).
    """
    segments: list[dict] = []
    prev_line = ""
    prev_first: int | None = None
    prev_last: int | None = None
    pending_first_pada = ""
    pending_first: int | None = None
    pending_last: int | None = None

    def flush_null(text: str, first: int, last: int):
        nonlocal prev_line, prev_first, prev_last
        if not text:
            return
        segments.append(
            {
                "text": text,
                "shloka_num": None,
                "first_line": first,
                "last_line": last,
            }
        )
        prev_line = ""
        prev_first = prev_last = None

    for line_no, raw in enumerate(lines):
        line = normalize_line(raw)
        if not line.strip():
            continue

        if is_sanskrit_line(line):
            if is_speaker_or_title(line):
                if verse_in_progress(pending_first_pada, prev_line) and is_skippable_inline_speaker(
                    line
                ):
                    continue
                if pending_first_pada:
                    flush_null(pending_first_pada, pending_first, pending_last)
                    pending_first_pada = ""
                    pending_first = pending_last = None
                if prev_line:
                    flush_null(prev_line, prev_first, prev_last)
                flush_null(line, line_no, line_no)
                continue

            if DOUBLE_VIRAMA in line:
                num = parse_shloka_num(line)
                if num is None:
                    if pending_first_pada:
                        prev_line = (
                            pending_first_pada + ("\n" if prev_line else "") + line
                        )
                        if prev_first is None:
                            prev_first = pending_first
                        prev_last = line_no
                        pending_first_pada = ""
                        pending_first = pending_last = None
                    elif prev_line:
                        prev_line += "\n" + line
                        prev_last = line_no
                    else:
                        prev_line = line
                        prev_first = prev_last = line_no
                    continue

                parts = []
                first_line = line_no
                if pending_first_pada:
                    parts.append(pending_first_pada)
                    first_line = pending_first if pending_first is not None else line_no
                    pending_first_pada = ""
                    pending_first = pending_last = None
                if prev_line:
                    parts.append(prev_line)
                    if prev_first is not None:
                        first_line = prev_first
                parts.append(line)
                text = "\n".join(parts)

                segments.append(
                    {
                        "text": text,
                        "shloka_num": num,
                        "first_line": first_line,
                        "last_line": line_no,
                    }
                )
                prev_line = ""
                prev_first = prev_last = None
            elif prev_line:
                prev_line += "\n" + line
                prev_last = line_no
            else:
                prev_line = line
                prev_first = prev_last = line_no
        else:
            if prev_line and DOUBLE_VIRAMA not in prev_line:
                if is_speaker_or_title(prev_line):
                    flush_null(prev_line, prev_first, prev_last)
                else:
                    pending_first_pada = prev_line
                    pending_first = prev_first
                    pending_last = prev_last
                    prev_line = ""
                    prev_first = prev_last = None
            elif prev_line:
                flush_null(prev_line, prev_first, prev_last)

    if pending_first_pada:
        flush_null(pending_first_pada, pending_first, pending_last)
    if prev_line:
        flush_null(prev_line, prev_first, prev_last)

    return segments


def main():
    lines = prepare_lines(sh.read("text.txt"))
    segments = segment_lines(lines)

    shloka_list = [
        {
            "text": s["text"],
            "index": i,
            "shloka_num": s["shloka_num"],
        }
        for i, s in enumerate(segments)
    ]

    sh.write("data.json", sh.dump_json(shloka_list))


if __name__ == "__main__":
    main()
