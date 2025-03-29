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
