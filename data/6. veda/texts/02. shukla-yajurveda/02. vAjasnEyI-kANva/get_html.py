#!/usr/bin/env python3

from __future__ import annotations

import os
import random
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import requests
import typer
from requests.adapters import HTTPAdapter
from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from urllib3.util.retry import Retry

app = typer.Typer(add_completion=False)
console = Console()

# shilka yajurveda > samhita > vajasneyi kANva > * (Adhyaya) > (shloka) Mantra
HTML_SAVE_DIR = (Path(__file__).resolve().parent / "../../../raw_data/2/1/1").resolve()

BASE = "https://vedicheritage.gov.in/samhitas/yajurveda/vajasneyi-madhyandina-samhita"
DEFAULT_TIMEOUT = (10, 60)  # (connect, read) seconds

# Global pacing to avoid bursty traffic with threads.
MIN_REQUEST_INTERVAL_S = 0.20
JITTER_S = 0.20

_thread_local = threading.local()


class RateLimiter:
    def __init__(self, min_interval_s: float, jitter_s: float):
        self.min_interval_s = float(min_interval_s)
        self.jitter_s = float(jitter_s)
        self._lock = threading.Lock()
        self._next_allowed_at = 0.0  # monotonic time

    def wait(self) -> None:
        sleep_for = 0.0
        with self._lock:
            now = time.monotonic()
            if now < self._next_allowed_at:
                sleep_for = self._next_allowed_at - now
                now = self._next_allowed_at
            self._next_allowed_at = now + self.min_interval_s

        if sleep_for > 0:
            time.sleep(sleep_for)
        if self.jitter_s > 0:
            time.sleep(random.random() * self.jitter_s)


GLOBAL_RATE_LIMITER = RateLimiter(MIN_REQUEST_INTERVAL_S, JITTER_S)


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_bytes(content)
    os.replace(tmp_path, path)


def _build_session(pool_maxsize: int) -> requests.Session:
    # We implement retries ourselves; disable urllib3 retries.
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    adapter = HTTPAdapter(
        pool_connections=pool_maxsize,
        pool_maxsize=pool_maxsize,
        max_retries=Retry(total=0, connect=0, read=0, redirect=0, status=0),
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _get_session(pool_maxsize: int) -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = _build_session(pool_maxsize=pool_maxsize)
        _thread_local.session = session
    return session


def _is_retryable_status(code: int) -> bool:
    return code in (429, 500, 502, 503, 504)


def get_with_retry(
    url: str,
    *,
    attempts: int,
    timeout: tuple[float, float],
    pool_maxsize: int,
) -> requests.Response:
    last_exc: Optional[Exception] = None
    attempts = max(1, int(attempts))

    for attempt in range(1, attempts + 1):
        GLOBAL_RATE_LIMITER.wait()
        try:
            resp = _get_session(pool_maxsize).get(
                url, timeout=timeout, allow_redirects=True
            )
            if _is_retryable_status(resp.status_code):
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp
        except requests.HTTPError as e:
            last_exc = e
            resp = getattr(e, "response", None)
            code = getattr(resp, "status_code", None)

            # 404 etc: don't retry here (caller may try alternate URL variants)
            if code is not None and not _is_retryable_status(int(code)):
                raise

            if attempt >= attempts:
                break
            delay = min(20.0, 0.75 * (2 ** (attempt - 1)))
            delay = delay + random.uniform(0.0, min(0.75, delay * 0.25))
            time.sleep(delay)
        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ContentDecodingError,
        ) as e:
            last_exc = e
            if attempt >= attempts:
                break
            delay = min(20.0, 0.75 * (2 ** (attempt - 1)))
            delay = delay + random.uniform(0.0, min(0.75, delay * 0.35))
            time.sleep(delay)

    assert last_exc is not None
    raise last_exc


def _candidates_for_adhyaya(n: int) -> list[str]:
    # Keep known URL quirks for 1 and 2 exactly as provided in your map.
    if n == 1:
        return [f"{BASE}/samhita-patha-0-10-adhyaya-01/"]
    if n == 2:
        return [
            f"{BASE}/samhita-patha-0-10-adhyaya-02-2/",
            f"{BASE}/samhita-patha-0-10-adhyaya-02/",
        ]

    # Kanva section pages.
    kanva_base = "https://vedicheritage.gov.in/samhitas/yajurveda/vajasaneyi-kanva-samhita"
    return [
        f"{kanva_base}/vajasaneyi-kanva-samhita-chapter-{n:02d}/",
        f"{kanva_base}/vajasaneyi-kanva-samhita-chapter-{n}/",
    ]


@dataclass(frozen=True)
class DownloadResult:
    adhyaya: int
    ok: bool
    path: Path
    url: Optional[str] = None
    error: Optional[str] = None


def _download_one(
    *,
    adhyaya: int,
    out_dir: Path,
    force: bool,
    attempts: int,
    pool_maxsize: int,
) -> DownloadResult:
    path = out_dir / f"{adhyaya}.html"
    if not force and path.exists() and path.stat().st_size > 0:
        return DownloadResult(adhyaya=adhyaya, ok=True, path=path, url=None, error=None)

    last_err: Optional[str] = None
    for url in _candidates_for_adhyaya(adhyaya):
        try:
            resp = get_with_retry(
                url,
                attempts=attempts,
                timeout=DEFAULT_TIMEOUT,
                pool_maxsize=pool_maxsize,
            )
            _atomic_write(path, resp.content)
            return DownloadResult(
                adhyaya=adhyaya, ok=True, path=path, url=str(resp.url)
            )
        except requests.HTTPError as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            last_err = f"HTTPError({code})"
            # If 404 (or other non-retryable status), try next URL candidate.
            continue
        except Exception as e:
            last_err = type(e).__name__
            # Network-ish errors are already retried inside get_with_retry; move to next candidate.
            continue

    return DownloadResult(
        adhyaya=adhyaya,
        ok=False,
        path=path,
        url=None,
        error=last_err or "UnknownError",
    )


@app.command()
def main(
    out_dir: Path = typer.Option(
        None,
        "--out-dir",
        "-o",
        help="Output folder for downloaded HTML (defaults to ../../../raw_data/2/1/1 relative to this script).",
    ),
    workers: int = typer.Option(
        5,
        "--workers",
        "-w",
        help="Thread pool size (max 5).",
    ),
    attempts: int = typer.Option(
        6,
        "--attempts",
        "-a",
        help="Retry attempts per URL candidate (for transient errors / 429 / 5xx).",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Redownload and overwrite existing files.",
    ),
    clear: bool = typer.Option(
        True,
        "--clear/--no-clear",
        help="Delete output folder before downloading (ignored if folder doesn't exist).",
    ),
    start: int = typer.Option(
        1,
        "--start",
        help="Start adhyaya (inclusive).",
    ),
    end: int = typer.Option(
        40,
        "--end",
        help="End adhyaya (inclusive).",
    ),
):
    """
    Download Shukla-Yajurveda (VAjasnEyI-kANva) adhyaya pages 1..40
    and save them as 1.html .. 40.html.
    """
    workers = max(1, min(5, int(workers)))
    attempts = max(1, int(attempts))
    start = int(start)
    end = int(end)
    if start < 1 or end > 40 or start > end:
        console.print("[bold red]Invalid range.[/] Use 1 <= start <= end <= 40.")
        raise typer.Exit(code=2)

    out_dir = HTML_SAVE_DIR if out_dir is None else Path(out_dir).expanduser().resolve()

    if clear and out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    console.print(
        f"[cyan]Downloading[/] adhyaya {start}..{end} to [bold]{out_dir}[/] "
        f"with workers={workers}, attempts={attempts}, force={force}"
    )

    results: list[DownloadResult] = []
    failures: list[DownloadResult] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        total = end - start + 1
        task = progress.add_task("Downloading", total=total)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_n = {
                executor.submit(
                    _download_one,
                    adhyaya=n,
                    out_dir=out_dir,
                    force=force,
                    attempts=attempts,
                    pool_maxsize=workers,
                ): n
                for n in range(start, end + 1)
            }
            for future in as_completed(future_to_n):
                n = future_to_n[future]
                try:
                    res = future.result()
                except Exception as e:
                    res = DownloadResult(
                        adhyaya=n,
                        ok=False,
                        path=out_dir / f"{n}.html",
                        error=type(e).__name__,
                    )
                results.append(res)
                if not res.ok:
                    failures.append(res)
                    console.print(f"[red]Failed[/] adhyaya {res.adhyaya}: {res.error}")
                progress.advance(task)

    # Report in order.
    results.sort(key=lambda r: r.adhyaya)
    failures.sort(key=lambda r: r.adhyaya)

    ok_count = sum(1 for r in results if r.ok)
    console.print(
        f"[green]Done.[/] ok={ok_count}/{len(results)} failed={len(failures)}"
    )
    if failures:
        console.print("[bold red]Failures:[/]")
        for r in failures:
            console.print(
                f"[red]- adhyaya {r.adhyaya} -> {r.path.name} (error={r.error})[/]"
            )
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
