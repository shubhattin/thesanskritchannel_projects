import shubhlipi as sh
from common import in_dev_range, DOUBLE_VIRAMA, SINGLE_VIRAMA
import re


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
        if in_dev_range(line[1]):
            prev_line += ("\n" if prev_line != "" else "") + line
            if DOUBLE_VIRAMA in line:
                shloka_list.append(
                    {
                        "text": prev_line,
                        "index": index,
                        "shloka_num": shloka_num,
                    }
                )
                prev_line = ""
                index += 1
                if not shloka_num:
                    shloka_num = 1
                else:
                    shloka_num += 1

    shloka_list[-1]["shloka_num"] = None

    sh.write("data.json", sh.dump_json(shloka_list))


if __name__ == "__main__":
    main()
