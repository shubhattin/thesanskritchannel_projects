from typing import Optional, Literal
import shubhlipi as sh
from pydantic import BaseModel
import yaml
import jinja2

NUMBERS = [
    "०",
    "१",
    "२",
    "३",
    "४",
    "५",
    "६",
    "७",
    "८",
    "९",
]
SINGLE_VIRAMA = "।"
DOUBLE_VIRAMA = "॥"
SPACE = " "
VISARGA = "ः"
HALANT = "्"
AVAGRAHA = "ऽ"
NEW_LINE = "\n"
DEV_RANGE = [2304, 2431]


def in_dev_range(char: str):
    """Check if the character is in devanagari range"""
    code = ord(char)
    return code <= DEV_RANGE[1] and code >= DEV_RANGE[0]


def from_dev_numbers(text: str):
    for i, num in enumerate(NUMBERS):
        text = text.replace(num, str(i))
    return text


def to_dev_numbers(text: str):
    for i, num in enumerate(NUMBERS):
        text = text.replace(str(i), num)
    return text


def get_formward_string(
    text: str, current_index: int, forward: int, include_current_index=False
):
    # this is to safely get the forward string, if the forward is more than the length of the text return till last
    current_index_modifier = int(not include_current_index)
    return (
        text[current_index + current_index_modifier : current_index + forward + 1]
        if current_index + forward < len(text)
        else text[current_index + current_index_modifier :]
    )


def is_permitted_dev_char(char: str):
    """only allow devanagari chacters exclude devanagart numbers, । and ॥"""
    return (
        in_dev_range(char)
        and char not in NUMBERS
        and char not in (SINGLE_VIRAMA, DOUBLE_VIRAMA)
    )


class ShlokaLevelInfo(BaseModel):
    type: Literal["shloka"] = "shloka"
    shloka_count: int
    total: int
    shloka_count_expected: int | None = None


class ListLevelInfo(BaseModel):
    type: Literal["list"] = "list"
    list_name: str
    list_count: int
    list_count_expected: Optional[int] = None


class SargaInfo(BaseModel):
    # Lowest level for Ramayanam map (3 levels total): Kanda -> Sarga -> (shloka info)
    name_dev: str
    name_nor: str
    pos: int
    info: ShlokaLevelInfo
    # required by TS recursive schema; for shloka nodes this is always empty
    list: list[object]


class KAndaInfo(BaseModel):
    name_dev: str
    name_nor: str
    pos: int
    info: ListLevelInfo
    list: list[SargaInfo]


class TextInfo(BaseModel):
    # Root object: holds the text name and list of kandas
    name_dev: str
    name_nor: str
    pos: int
    info: ListLevelInfo
    list: list[KAndaInfo]


class ShlokaInfo(BaseModel):
    text: str
    index: int
    shloka_num: int | None = None


DATA_ROOT = TextInfo(**sh.load_json(sh.read("ramayanam_map.json")))
# Back-compat for scripts that iterate kandas directly
DATA = DATA_ROOT.list
SANSKRIT_NUMBER_NAMES: list[list[int | str]] = yaml.safe_load(sh.read("numbers.yaml"))

TEMPLATE_FOLDER = "template"


def render_template(fl_name: str, **o) -> str:
    return (
        jinja2.Environment(loader=jinja2.FileSystemLoader("template"))
        .get_template(fl_name)
        .render(**o)
    )
