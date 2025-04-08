import shubhlipi as sh
from common import in_dev_range, DOUBLE_VIRAMA, SINGLE_VIRAMA


def main():
    data = sh.read("text.txt").replace("\r\n", "\n")
    data = data.split("\n")

    shloka_list = []

    index = 0
    shloka_num = None
    prev_line = ""
    for line in data:
        if line.strip() == "":
            continue
        if in_dev_range(line[0]):
            prev_line += "\n" + line
            if DOUBLE_VIRAMA in line:
                shloka_list.append(
                    {
                        "text": prev_line.strip(),
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
