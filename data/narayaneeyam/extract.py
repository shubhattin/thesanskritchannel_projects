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

    """This will help us ignore repetitions"""
    prev_shloka = False

    for line in text.splitlines():
        if len(line) == 0:
            continue
        if in_dev_range(line[0]):
            if index <= 3:
                shloka_list.append({"text": line, "index": index, "shloka_num": None})
                index += 1
            else:
                prev_line += ("\n" if prev_line != "" else "") + line
                if DOUBLE_VIRAMA in line:
                    obj = {
                        "text": prev_line,
                        "index": index,
                        "shloka_num": shloka_index,
                    }
                    if not prev_shloka:
                        shloka_index += 1
                        shloka_list.append(obj)
                        prev_line = ""
                        index += 1
                        prev_shloka = True
                    else:
                        prev_line = ""
                        prev_shloka = False

    shloka_list[-1]["shloka_num"] = None
    if file_index == 18:
        shloka_list[-2]["shloka_num"] = None

    return {"text": shloka_list}


if os.path.exists("data"):
    sh.delete_folder("data")
sh.makedir("data")

for i in range(1, 100):
    text_data = sh.read(f"text_data/{i}.txt")
    data = extract_data_from_text(sh.read(f"text_data/{i}.txt"), i)
    sh.write(f"text_data/{i}.txt", text_data.replace("\r\n", "\n"))
    sh.write(
        f"data/{i}.json",
        sh.dump_json(data["text"]),
    )
