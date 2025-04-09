import shubhlipi as sh
from common import in_dev_range, DOUBLE_VIRAMA, SINGLE_VIRAMA
import re
import os


def main():
    data = sh.read("text.txt").replace("\r\n", "\n")
    data = data.replace("||", DOUBLE_VIRAMA)
    data = data.replace("|", SINGLE_VIRAMA)
    data = data.split("\n")

    shloka_list = []

    index = 0
    shloka_num = None
    prev_line = ""
    for line in data:
        line = re.sub(r"(?<={0}) (?=\d)".format(DOUBLE_VIRAMA), "", line)
        line = re.sub(r"(?<=\d) (?={0})".format(DOUBLE_VIRAMA), "", line)
        line = re.sub(r"(?<=\S)(?={0}\d{0})".format(DOUBLE_VIRAMA), " ", line)
        line = re.sub(r"(?<=\S)(?={0}\d\d{0})".format(DOUBLE_VIRAMA), " ", line)
        line = re.sub(r"(?<=\S)(?={0})".format(SINGLE_VIRAMA), " ", line)
        if line.strip() == "":
            continue
        if in_dev_range(line[0]) or (in_dev_range(line[2]) and index < 3):
            prev_line += ("\n" if prev_line != "" else "") + line
            if DOUBLE_VIRAMA in line:
                if index == 104 and "\n" not in prev_line:
                    continue
                shloka_num_null_condition = "भागः - " in prev_line
                shloka_list.append(
                    {
                        "text": prev_line,
                        "index": index,
                        "shloka_num": (
                            shloka_num if not shloka_num_null_condition else None
                        ),
                    }
                )
                prev_line = ""
                index += 1
                if index > 2 and not shloka_num:
                    shloka_num = 1
                elif shloka_num:
                    if not shloka_num_null_condition:
                        shloka_num += 1

    shloka_list[-1]["shloka_num"] = None

    sh.write("data.json", sh.dump_json(shloka_list))


def extarct_trans():
    if not os.path.exists("tmp"):
        sh.makedir("tmp")

    data = (
        sh.read("text.txt")
        .replace("\r\n", "\n")
        .replace("\n\n\n", "\n\n")
        .replace("||", DOUBLE_VIRAMA)
        .replace("|", SINGLE_VIRAMA)
    )
    # data = re.sub(r"(?<=\n)\s+(?<=\n)", "", data)

    lines = data.split("\n\n")
    trans_list = []

    for i in range(0, len(lines), 3):
        if i + 2 >= len(lines):
            break
        trans_list.append(
            {
                "project_id": 5,
                "lang_id": 1,
                "second": 0,
                "first": 0,
                "text": lines[i + 2],
                "index": i // 3,
            }
        )
    sh.write("tmp/trans.json", sh.dump_json(trans_list))


if __name__ == "__main__":
    main()
    extarct_trans()
