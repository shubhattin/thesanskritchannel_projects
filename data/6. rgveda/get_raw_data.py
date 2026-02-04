#!/usr/bin/env python3

import os
import typer
from rich.console import Console
from rich.prompt import Prompt

app = typer.Typer()
console = Console()


RGVEDA_SHAKALA_SAMHITA_HOME = (
    "https://vedicheritage.gov.in/samhitas/rigveda/shakala-samhita/"
)


@app.command()
def main():
    pass
