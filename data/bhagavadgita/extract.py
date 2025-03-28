import re
import os
from rich import print
import shubhlipi as sh
from common import in_dev_range, DOUBLE_VIRAMA, SINGLE_VIRAMA


def extract_data_from_text(text: str, file_index: int):
    shloka_list = []
    lines: list[str] = text.splitlines()
    prev_line = ""
    index = 0
    shloka_index = 1
    INDEPENDEDNT_LINES = [
        "धृतराष्ट्र उवाच",
        "सञ्जय उवाच",
        "अर्जुन उवाच",
        "रीभगवानुवाच",
    ]
    for line in lines:
        line = line.strip()
        line = re.sub(r"(?<={0}) (?=\d)".format(DOUBLE_VIRAMA), "", line)
        line_word_count = len(
            line.replace(DOUBLE_VIRAMA, "")
            .replace(SINGLE_VIRAMA, "")
            .strip()
            .split(" ")
        )
        if len(line) > 0 and in_dev_range(line[0]):
            is_indep_line = any(
                x in line and line_word_count == len(x.split(" "))
                for x in INDEPENDEDNT_LINES
            )
            if (is_indep_line and prev_line == "") or index <= 2:
                shloka_list.append({"text": line, "index": index, "shloka_num": None})
                prev_line = ""
                index += 1
                continue
            prev_line += ("\n" if prev_line != "" else "") + line
            if DOUBLE_VIRAMA in line:
                obj = {
                    "text": prev_line,
                    "index": index,
                    "shloka_num": shloka_index,
                }
                shloka_index += 1
                shloka_list.append(obj)
                prev_line = ""
                index += 1
    shloka_list[-1]["shloka_num"] = None
    if file_index == 18:
        shloka_list[-2]["shloka_num"] = None

    return {"text": shloka_list}


def update_gita_map():
    g_map = sh.load_json(sh.read("gita_map.json"))
    for i in range(1, 19):
        data = sh.load_json(sh.read(f"data/{i}.json"))
        g_map[i - 1]["total"] = len(data)
        shloka_count = 0
        for shloka in data:
            if shloka["shloka_num"]:
                shloka_count = shloka["shloka_num"]
        g_map[i - 1]["shloka_count"] = shloka_count
    sh.write("gita_map.json", sh.dump_json(g_map, 2))


if os.path.exists("data"):
    sh.delete_folder("data")
sh.makedir("data")

for i in range(1, 19):
    text_data = sh.read(f"raw_data/{i}.txt")
    data = extract_data_from_text(sh.read(f"raw_data/{i}.txt"), i)
    sh.write(f"raw_data/{i}.txt", text_data.replace("\r\n", "\n"))
    sh.write(
        f"data/{i}.json",
        sh.dump_json(data["text"]),
    )

update_gita_map()
