#!/usr/bin/env python3

import os
import time
import sys

import typer
from rich.console import Console
from rich.prompt import Confirm
import shubhlipi as sh
from typing import Literal
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from run_tests import run_tests
from common import (
    DATA,
    DOUBLE_VIRAMA,
    SINGLE_VIRAMA,
    NUMBERS,
    SANSKRIT_NUMBER_NAMES,
    to_dev_numbers,
    SPACE,
    NEW_LINE,
    is_permitted_dev_char,
)
import get_text


app = typer.Typer()
console = Console()

OUTPUT_DATA_FOLDER = "data"
TEXT_DATA_FOLDER = "text_data"


def get_shloka_json(path: str):
    """extract the shlokas from text and save them into json"""

    # these nums are in normal formaat
    kANDa_num = path.split("/")[-2]
    sarga_num = path.split("/")[-1].split(".")[0]

    def check_kANDa_sarga(kanda: int, sarga: int):
        """Check if the kANDa and sarga are same"""
        if kANDa_num == str(kanda) and sarga_num == str(sarga):
            return True
        return False

    def check_kANDa(kanda: int):
        """Check if the kANDa is same"""
        if kANDa_num == str(kanda):
            return True
        return False

    kANDa_info = DATA[int(kANDa_num) - 1]
    sarga_info = kANDa_info.sarga_data[int(sarga_num) - 1]

    shlokAni: str = sh.read(f"{TEXT_DATA_FOLDER}/{kANDa_num}/{sarga_num}.txt")

    shloka_list: list[str] = []

    def get_first_line():
        template = (
            lambda kANDa_dev_name, sarga_dev_name, sanskrit_number_sarga: f"अथ श्रीमद्वाल्मीकीयरामायणे {kANDa_dev_name} {sarga_dev_name} नाम {sanskrit_number_sarga} सर्गः ॥{to_dev_numbers(kANDa_num)}-{to_dev_numbers(sarga_num)}॥"
        )
        e_mAtrA = "े"  # from 1st to 7nd vibhakti
        kANDa_name = kANDa_info.name_devanagari[:-1] + e_mAtrA
        sarga_name = sarga_info.name_devanagari.splitlines()[0]
        line = template(
            kANDa_name,
            sarga_name,
            SANSKRIT_NUMBER_NAMES[int(sarga_num) - 1][1],
        )
        return line

    def get_last_line():
        template = (
            lambda kANDa_dev_name, sanskrit_number_sarga, sarga_dev_name: f"इत्यार्षे श्रीमद्रामायणे वाल्मीकीये आदिकाव्ये {kANDa_dev_name} {sarga_dev_name} नाम {sanskrit_number_sarga} सर्गः ॥{to_dev_numbers(kANDa_num)}-{to_dev_numbers(sarga_num)}॥"
        )
        e_mAtrA = "े"
        sarga_name = sarga_info.name_devanagari.splitlines()[0]
        kANda_name = kANDa_info.name_devanagari[:-1] + e_mAtrA
        line = template(
            kANda_name, SANSKRIT_NUMBER_NAMES[int(sarga_num) - 1][1], sarga_name
        )
        return line

    shloka_list.append(get_first_line())

    # Analysing the main shlokas
    current_shloka: str = ""
    line_ended: bool = False
    shloka_numb: int = 1
    for line in shlokAni.split(NEW_LINE):

        def check_kANDa_sarga_shloka(kANDa: int, sarga: int, shloka: int):
            if check_kANDa_sarga(kANDa, sarga) and shloka_numb == shloka:
                return True
            return False

        for i, char in enumerate(line):
            if not line_ended:
                # to be more careful before we consider the double virama
                # we have to see that if after that it is terminated another double virama and at least one
                # devanagari number in between
                # the more than 1 single virama was there on 1-1-84
                DOUBLE_VIRAMA_CONDITION = current_shloka != "" and char == DOUBLE_VIRAMA
                if DOUBLE_VIRAMA_CONDITION:
                    str_to_search = line[i + 1 :]
                    another_double_virama_loc = str_to_search.find(DOUBLE_VIRAMA)
                    if another_double_virama_loc != -1:
                        str_to_search_for_dev_numbers = str_to_search[
                            :another_double_virama_loc
                        ]
                        atleast_one_dev_number_found = False
                        for dev_num in NUMBERS:
                            if dev_num in str_to_search_for_dev_numbers:
                                atleast_one_dev_number_found = True
                        if not atleast_one_dev_number_found:
                            DOUBLE_VIRAMA_CONDITION = False
                    else:
                        DOUBLE_VIRAMA_CONDITION = False
                if DOUBLE_VIRAMA_CONDITION:
                    if current_shloka[-1] != SPACE:
                        current_shloka += SPACE  # add space before danda if not there
                    current_shloka += (
                        DOUBLE_VIRAMA
                        + to_dev_numbers(f"{kANDa_num}-{sarga_num}-{shloka_numb}")
                        + DOUBLE_VIRAMA
                    )
                    shloka_list.append(current_shloka)
                    current_shloka = ""
                    shloka_numb += 1
                    line_ended = False
                elif current_shloka != "" and char == SINGLE_VIRAMA:
                    if current_shloka[-1] != SPACE:
                        current_shloka += SPACE  # add space before danda if not there
                    current_shloka += char + NEW_LINE
                    line_ended = True
                elif is_permitted_dev_char(char) or (
                    current_shloka != ""
                    and char == SPACE
                    and current_shloka[-1] != SPACE
                ):  # accept space if in middle of shloka only and one only one max space
                    if (
                        current_shloka != ""
                        and current_shloka[-1] not in (NEW_LINE, SPACE)
                        and i == 0
                    ):  # adding space when a single line spans across multiple lines in .txt file
                        # using i=0 as it marks the start of the line
                        current_shloka += " "
                    current_shloka += char
            else:
                if is_permitted_dev_char(char):
                    current_shloka += char
                    line_ended = False

    shloka_list.append(get_last_line())

    # Updating the shloka count of the sarga
    sarga_info.shloka_count_extracted = len(shloka_list) - 2

    out_folder = f"{OUTPUT_DATA_FOLDER}/{kANDa_num}/{sarga_num}.json"
    sh.write(out_folder, sh.dump_json(shloka_list, 2))


class ChangeHandler(FileSystemEventHandler):
    def __init__(self, execute_task, debounce_time=1):
        self.execute_task = execute_task
        self.debounce_time = debounce_time
        self.last_modified = {}

    def on_modified(self, event):
        if event.is_directory:
            return

        pth = str(event.src_path)
        if pth.endswith(".txt") and pth.startswith(TEXT_DATA_FOLDER):
            # Check debounce to avoid multiple triggers for the same event
            current_time = time.time()
            last_time = self.last_modified.get(pth, 0)

            if current_time - last_time >= self.debounce_time:
                name = "/".join(pth.split("/")[1:])
                console.log(f"[yellow]Change detected in: [blue]{name}[/][/]")
                self.execute_task(pth)
                self.last_modified[pth] = current_time


@app.command()
def main(
    no_confirm: bool = typer.Option(True, "--no-confirm", "-y"),
    run_test: bool = True,
    watch: bool = False,
    log_time: bool = True,
):
    if not os.path.isdir(TEXT_DATA_FOLDER):
        console.print("[bold red]Text Data folder not found![/]")
        sys.exit(-1)

    def execute_task(paths: Literal["all"] | str = "all"):
        # Checking if raw data already exists
        if paths == "all":
            if os.path.isdir(OUTPUT_DATA_FOLDER):
                if not no_confirm:
                    choice = Confirm.ask(
                        "[yellow]Raw Data already exists, do you want to recreate it ?[/]"
                    )
                    if not choice:
                        return
                sh.delete_folder(OUTPUT_DATA_FOLDER)
                sh.makedir(OUTPUT_DATA_FOLDER)
            else:
                sh.makedir(OUTPUT_DATA_FOLDER)

            for kANDa_num in os.listdir(TEXT_DATA_FOLDER):
                # Only taking the number to create json folder
                sh.makedir(f"{OUTPUT_DATA_FOLDER}/{kANDa_num}")

            # Running get text
            get_text.main(use_existing_text=True)

        start_time = time.time()
        for root, _, files in os.walk(TEXT_DATA_FOLDER):
            for file in files:
                path = os.path.join(root, file)
                if paths != "all" and path != paths:
                    continue
                # console.log(path, paths)
                get_shloka_json(path)
        end_time = time.time()

        # saving the DATA back into ramayan_map.json
        sh.write(
            "ramayan_map.json", sh.dump_json([kANDa.model_dump() for kANDa in DATA], 2)
        )
        if log_time:
            console.log(f"[white bold]Time: {round(end_time-start_time)}s[/]")
        if paths != "all":
            run_tests(False)

    execute_task()
    if watch:
        event_handler = ChangeHandler(execute_task)
        observer = Observer()
        observer.schedule(event_handler, TEXT_DATA_FOLDER, recursive=True)
        observer.start()

        console.log(
            "[bold green]Watching for changes in text_data folder...[white], Check for live test output in [yellow]'data/ramayan/test_output.md'[/][/][/]"
        )

        try:
            while True:
                time.sleep(3)  # Keep the script running
        except KeyboardInterrupt:
            observer.stop()
            console.log("[white bold]Exiting...[/]")
        observer.join()
        execute_task()
    if run_test:
        # running tests after each scraping
        run_tests()


if __name__ == "__main__":
    app()
