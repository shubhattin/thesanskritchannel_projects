import os
from rich import print

JSON_MAKE_COMMAND_LIST = [
    ["01. rgveda", "get_json_data.py --silent"],
]


def main():
    for command in JSON_MAKE_COMMAND_LIST:
        cmd = f'cd "texts/{command[0]}" && uv run {command[1]}'
        os.system(cmd)
        print(f"{command[0]}")
    print("[bold green]All JSON files generated successfully[/]")


if __name__ == "__main__":
    main()
