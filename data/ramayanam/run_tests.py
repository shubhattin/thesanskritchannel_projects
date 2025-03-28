#!/usr/bin/env python3

import os
from functools import reduce

from pydantic import BaseModel
from rich.console import Console
from typer import Typer
import shubhlipi as sh
from common import render_template, DOUBLE_VIRAMA, SINGLE_VIRAMA, NEW_LINE, DATA

app = Typer()
console = Console()

DATA_FOLDER = "data"


class TestInfo(BaseModel):
    test_title: str
    test_info: str
    failed_cases: list[str] = []
    report_test_fail_if_found: bool = True
    index: int
    variance: list[int] = []


TEST_INFO: list[TestInfo] = []


def init_test_info():
    global TEST_INFO
    TEST_INFO = [
        TestInfo(
            test_title="Check for empty json files",
            test_info="These files are empty",
            index=0,
        ),  # 0
        TestInfo(
            test_title=f"Check for {SINGLE_VIRAMA} before line break",
            test_info="virAma not present before new line in",
            index=1,
        ),  # 1
        TestInfo(
            test_title=f"Single Line Shlokas",
            test_info="Single line shlokas found",
            report_test_fail_if_found=False,
            index=2,
        ),  # 2
        TestInfo(
            test_title=f"Line Count more than 3",
            test_info="Shlokas with more than 3 lines",
            report_test_fail_if_found=False,
            index=4,
        ),  # 3
        TestInfo(
            test_title="Variance in Shloka Count from Book Source",
            test_info="Sargas with Shloka count variance (`L → extracted|R → book|difference from book`)",
            report_test_fail_if_found=False,
            index=5,
        ),  # 4
        TestInfo(
            test_title=f"Check for {DOUBLE_VIRAMA} at the end of shloka",
            test_info="Double virAma not present at the end in these shlokas",
            index=6,
        ),  # 5
        TestInfo(
            test_title=f"3 Line Shlokas",
            test_info="Shlokas with 3 lines",
            report_test_fail_if_found=False,
            index=3,
        ),  # 6
    ]


def _run_tests(data: list[str], kANDa_num: str, sarga_num: str):
    global TEST_INFO

    def check_kANDa_sarga(kanda: int, sarga: int):
        """Check if the kANDa and sarga are same"""
        if kANDa_num == str(kanda) and sarga_num == str(sarga):
            return True
        return False

    EMPTY_TEST = TEST_INFO[0]
    if len(data) <= 2:
        EMPTY_TEST.failed_cases.append(f"{kANDa_num}-{sarga_num}")
        return
    # if check_kANDa_sarga(2, 1):
    #     EMPTY_TEST.failed_cases.append("1-16")
    #     EMPTY_TEST.failed_cases.append("2-37")
    #     return

    # check if before a line break only single or double is sent
    # this test case actually is not needed after we have updared our json extraction algorithm
    VIRAMA_TEST = TEST_INFO[1]
    SINGLE_LINE_TEST = TEST_INFO[2]
    MORE_THAN_3_TEST = TEST_INFO[3]
    THREE_LINE_TEST = TEST_INFO[6]
    DOUBLE_VIRAMA_TEST = TEST_INFO[5]
    for ln_ind, lines in enumerate(data):
        # ln_ind will act as shloka number as first line in start
        if lines.count(DOUBLE_VIRAMA) != 2 and lines[-1] != DOUBLE_VIRAMA:
            DOUBLE_VIRAMA_TEST.failed_cases.append(f"{kANDa_num}-{sarga_num}-{ln_ind}")
        line_split = lines.splitlines()
        for line_no, line in enumerate(line_split):
            if line_no != len(line_split) - 1 and line[-1] != SINGLE_VIRAMA:
                VIRAMA_TEST.failed_cases.append(f"{kANDa_num}-{sarga_num}-{ln_ind}")
        # if check_kANDa_sarga(1, 1):
        #     VIRAMA_TEST.failed_cases.append(f"{kANDa_num}-{sarga_num}-{ln_ind+1}")
        if ln_ind not in (0, len(data) - 1):
            if lines.count(NEW_LINE) == 0:
                # if not starting or ending line but still a single line
                SINGLE_LINE_TEST.failed_cases.append(
                    f"{kANDa_num}-{sarga_num}-{ln_ind}"
                )
            elif lines.count(NEW_LINE) == 2:  # checking for 3 lined
                THREE_LINE_TEST.failed_cases.append(f"{kANDa_num}-{sarga_num}-{ln_ind}")
            elif lines.count(NEW_LINE) >= 3:  # checking for 4 lined and more
                MORE_THAN_3_TEST.failed_cases.append(
                    f"{kANDa_num}-{sarga_num}-{ln_ind} → {lines.count(NEW_LINE) + 1}"
                )

    SARGA_SHLOKA_COUNT_TEST = TEST_INFO[4]
    sarga_info = DATA[int(kANDa_num) - 1].sarga_data[int(sarga_num) - 1]
    if sarga_info.shloka_count != sarga_info.shloka_count_extracted:
        diff = sarga_info.shloka_count_extracted - sarga_info.shloka_count
        SARGA_SHLOKA_COUNT_TEST.variance.append(diff)
        SARGA_SHLOKA_COUNT_TEST.failed_cases.append(
            f"{kANDa_num}-{sarga_num} → {sarga_info.shloka_count_extracted}|{sarga_info.shloka_count}| "
            + ("+" if diff > 0 else "-")
            + f"{abs(diff)}"
        )
    return TEST_INFO


@app.command()
def run_tests(log: bool = True):
    global TEST_INFO
    init_test_info()
    if not os.path.isdir(DATA_FOLDER):
        console.print("[bold red]Raw Data folder not found![/]")
        exit(-1)
    for kANDa_info in DATA:
        for sarga in kANDa_info.sarga_data:
            data = sh.load_json(
                sh.read(f"{DATA_FOLDER}/{kANDa_info.index}/{sarga.index}.json")
            )
            _run_tests(data, str(kANDa_info.index), str(sarga.index))

    all_tests_passed = (
        reduce(
            lambda prev, val: (
                prev + (len(val.failed_cases) if val.report_test_fail_if_found else 0)
            ),
            TEST_INFO,
            0,
        )
        == 0
    )  # if no failed cases

    def get_test_with_index(i: int):
        # return next(filter(lambda x: x.index == i, TEST_INFO))
        return list(filter(lambda x: x.index == i, TEST_INFO))[0]

    def get_variance_sum_for_kANDa(kANDa: int, test: TestInfo):
        sum = 0
        if len(test.variance) == 0:
            return None
        for i, kanda in enumerate(test.failed_cases):
            if kanda.startswith(f"{kANDa}-"):
                sum += test.variance[i]
        return sum

    RENDER_DATA = {
        "all_tests_passed": all_tests_passed,
        "test_info": TEST_INFO,
        "get_test_with_index": get_test_with_index,
        "get_variance_sum_for_kANDa": get_variance_sum_for_kANDa,
        "filter_function": lambda lst, start_text: list(
            map(
                lambda x: "-".join(x.split("-")[1:]),
                filter(lambda x: x.startswith(f"{start_text}-"), lst),
            )
        ),
    }
    RENDERRED_OUTPUT_MD = render_template("test_out_template.md.j2", **RENDER_DATA)
    sh.write("test_output.md", RENDERRED_OUTPUT_MD)
    if log:
        if all_tests_passed:
            console.print("[bold green]✔ All Tests passed![/]")
            exit(0)
        else:
            console.print("\n[bold red]❌ Some Tests failed![/]")
            exit(-1)


if __name__ == "__main__":
    app()
