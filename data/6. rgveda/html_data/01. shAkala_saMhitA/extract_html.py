import os
import json
import random
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import requests
from pyquery import PyQuery
from requests.adapters import HTTPAdapter
from rich.console import Console
import typer
from urllib3.util.retry import Retry

app = typer.Typer()
console = Console()

HOSTNAME = "https://vedicheritage.gov.in"
SHAKALA_SAMHITA_MANDALA_LIST_PAGE = (
    "https://vedicheritage.gov.in/samhitas/rigveda/shakala-samhita/"
)
USER_AGENT_HEADER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

DEFAULT_TIMEOUT = (10, 45)  # (connect, read) seconds
MAX_ATTEMPTS = 8

# Throttle to avoid aggressive scraping causing server-side resets.
MIN_REQUEST_INTERVAL_S = 0.25
JITTER_S = 0.25

# Backoff for retries (network errors, 429, and transient 5xx).
MAX_BACKOFF_S = 25.0

_thread_local = threading.local()


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def _atomic_write(path: str, content: bytes) -> None:
    _ensure_parent_dir(path)
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "wb") as f:
        f.write(content)
    os.replace(tmp_path, path)


class RateLimiter:
    """
    Global rate limiter shared across threads.

    We space out request *start times* to avoid bursty traffic that can trigger
    server-side connection resets. Multiple threads can still have requests in
    flight, but the overall request rate is controlled.
    """

    def __init__(self, min_interval_s: float, jitter_s: float):
        self.min_interval_s = float(min_interval_s)
        self.jitter_s = float(jitter_s)
        self._lock = threading.Lock()
        self._next_allowed_at = 0.0  # monotonic

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


def _build_session() -> requests.Session:
    # We'll do our own retry/backoff. Disable urllib3 internal retries.
    session = requests.Session()
    session.headers.update(
        {
            **USER_AGENT_HEADER,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    adapter = HTTPAdapter(
        pool_connections=8,
        pool_maxsize=8,
        max_retries=Retry(total=0, connect=0, read=0, redirect=0, status=0),
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _get_session() -> requests.Session:
    """
    requests.Session is not guaranteed to be thread-safe. Use one session per
    worker thread to keep pooling benefits safely.
    """
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = _build_session()
        _thread_local.session = session
    return session


class RetryableHTTPStatus(Exception):
    def __init__(self, status_code: int, retry_after_s: Optional[float] = None):
        super().__init__(f"Retryable HTTP status: {status_code}")
        self.status_code = status_code
        self.retry_after_s = retry_after_s


def _parse_retry_after_seconds(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        return float(int(value.strip()))
    except Exception:
        return None


def _is_retryable_status(status_code: int) -> bool:
    return status_code in (429, 500, 502, 503, 504)


def get_with_retry(url: str) -> requests.Response:
    """
    Robust GET wrapper:
    - throttles requests (politeness)
    - retries transient network errors (incl. connection reset)
    - retries 429/5xx with exponential backoff + jitter
    """
    last_exc: Optional[Exception] = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        GLOBAL_RATE_LIMITER.wait()
        try:
            resp = _get_session().get(
                url, timeout=DEFAULT_TIMEOUT, allow_redirects=True
            )
            if _is_retryable_status(resp.status_code):
                raise RetryableHTTPStatus(
                    status_code=resp.status_code,
                    retry_after_s=_parse_retry_after_seconds(
                        resp.headers.get("Retry-After")
                    ),
                )
            resp.raise_for_status()
            return resp
        except RetryableHTTPStatus as e:
            last_exc = e
            if attempt >= MAX_ATTEMPTS:
                break
            backoff = min(MAX_BACKOFF_S, 0.75 * (2 ** (attempt - 1)))
            delay = e.retry_after_s if e.retry_after_s is not None else backoff
            delay = delay + random.uniform(0, min(0.75, delay * 0.25))
            console.print(
                f"[yellow]HTTP {e.status_code} for {url} (attempt {attempt}/{MAX_ATTEMPTS}); retrying in {delay:.2f}s[/]"
            )
            time.sleep(delay)
        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ContentDecodingError,
        ) as e:
            # Includes: ConnectionResetError(104) wrapped by requests/urllib3
            last_exc = e
            if attempt >= MAX_ATTEMPTS:
                break
            delay = min(MAX_BACKOFF_S, 0.75 * (2 ** (attempt - 1)))
            delay = delay + random.uniform(0, min(0.75, delay * 0.35))
            console.print(
                f"[yellow]{type(e).__name__} for {url} (attempt {attempt}/{MAX_ATTEMPTS}); retrying in {delay:.2f}s[/]"
            )
            time.sleep(delay)
        except requests.exceptions.HTTPError:
            # Non-retryable HTTP error: surface it.
            raise

    assert last_exc is not None
    raise last_exc


@app.command()
def get_links_json(
    download_workers: int = typer.Option(
        8,
        "--download-workers",
        "-w",
        help="Thread pool size for downloading HTML files (5-10 recommended).",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        help="Redownload and overwrite existing HTML files.",
    ),
):
    """
    Get links for all the mandalas and the corresponding suktas under them
    """
    download_workers = max(1, int(download_workers))

    overall_failed: list[dict] = []
    total_downloaded = 0
    total_skipped = 0

    mandala_links: list[str] = []
    MANDA_LIST_CACHE_FILE = "json_url_cache/shakala_samhita_mandala_list.json"
    if os.path.exists(MANDA_LIST_CACHE_FILE):
        with open(MANDA_LIST_CACHE_FILE, "r") as f:
            mandala_links = json.load(f)
    else:
        req = get_with_retry(SHAKALA_SAMHITA_MANDALA_LIST_PAGE)
        html = PyQuery(req.text)
        mandala_list = html("#cn-wrapper.cn-wrapper > ul > li > a")
        for mandala in mandala_list.items():
            url = mandala.attr("href")
            # ^ The url is a redirected url resolve it
            resolved_url = str(get_with_retry(HOSTNAME + url).url)
            console.print(resolved_url)
            mandala_links.append(resolved_url)
        _ensure_parent_dir(MANDA_LIST_CACHE_FILE)
        with open(MANDA_LIST_CACHE_FILE, "w") as f:
            json.dump(mandala_links, f, indent=2)

    for mandala_index, mandala_link in enumerate(mandala_links):
        SUKTA_CACHE_FILE = f"json_url_cache/sukta/{mandala_index + 1}.json"
        sukat_list: list[str] = []
        if os.path.exists(SUKTA_CACHE_FILE):
            with open(SUKTA_CACHE_FILE, "r") as f:
                sukat_list = json.load(f)
        else:
            CSS_SELECTORS = [
                "html body.wp-singular.page-template.page-template-mandal-template.page-template-mandal-template-php.page.page-id-343.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.col-lg-3.col-md-3.col-sm-3 div.row div.primewp-side-widget.widget.primewp-box.widget_black_studio_tinymce div.primewp-box-inside div.primewp-widget-header div ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-2.page-template-mandal-2-php.page.page-id-4013.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.col-lg-3.col-md-3.col-sm-3 div.row div.primewp-side-widget.widget.primewp-box.widget_black_studio_tinymce div.primewp-box-inside div.primewp-widget-header ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-3.page-template-mandal-3-php.page.page-id-4030.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-4.page-template-mandal-4-php.page.page-id-4034.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-5.page-template-mandal-5-php.page.page-id-4048.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-6.page-template-mandal-6-php.page.page-id-4075.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-7.page-template-mandal-7-php.page.page-id-4079.page-parent.page-child.parent-pageid-7887.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-8.page-template-mandal-8-php.page.page-id-4096.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-9.page-template-mandal-9-php.page.page-id-4105.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
                "html body.wp-singular.page-template.page-template-mandal-10.page-template-mandal-10-php.page.page-id-4109.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.con-box div.col-lg-12.col-md-12.col-sm-12 div.PT10 div.col-lg-3.col-md-3.col-sm-3 div.newbg ul.mandalbtn.mandallinks-scrolling > li > a",
            ]
            console.print(
                f"Fetching suktas for mandala {mandala_index + 1}",
                mandala_link,
            )
            req = get_with_retry(mandala_link)
            html = PyQuery(req.text)
            sukta_links = html(CSS_SELECTORS[mandala_index])
            for sukta in sukta_links.items():
                url = str(get_with_retry(HOSTNAME + sukta.attr("href")).url)
                console.print(sukta.attr("href"), url)
                sukat_list.append(url)
            if len(sukat_list) > 0:
                _ensure_parent_dir(SUKTA_CACHE_FILE)
                with open(SUKTA_CACHE_FILE, "w") as f:
                    json.dump(sukat_list, f, indent=2)

        console.print(
            f"[cyan]Downloading HTML for mandala {mandala_index + 1} "
            f"({len(sukat_list)} suktas) with {download_workers} threads...[/]"
        )

        def _download_one(
            m_idx: int, s_idx: int, page_url: str
        ) -> tuple[str, int, int, str]:
            save_path = f"../../raw_data/1/1/{m_idx + 1}/{s_idx + 1}.html"
            if (
                (not force)
                and os.path.exists(save_path)
                and os.path.getsize(save_path) > 0
            ):
                return ("skipped", m_idx, s_idx, save_path)

            resp = get_with_retry(page_url)
            _atomic_write(save_path, resp.content)
            return ("downloaded", m_idx, s_idx, save_path)

        mandala_failed: list[dict] = []
        mandala_downloaded = 0
        mandala_skipped = 0

        with ThreadPoolExecutor(max_workers=download_workers) as executor:
            future_to_ctx = {
                executor.submit(
                    _download_one, mandala_index, sukta_index, sukta_link
                ): (sukta_index, sukta_link)
                for sukta_index, sukta_link in enumerate(sukat_list)
            }
            for future in as_completed(future_to_ctx):
                sukta_index, sukta_link = future_to_ctx[future]
                try:
                    status, m_idx, s_idx, save_path = future.result()
                    if status == "downloaded":
                        mandala_downloaded += 1
                    else:
                        mandala_skipped += 1
                except Exception as e:
                    save_path = (
                        f"../../raw_data/1/1/{mandala_index + 1}/{sukta_index + 1}.html"
                    )
                    mandala_failed.append(
                        {
                            "mandala": mandala_index + 1,
                            "sukta": sukta_index + 1,
                            "url": sukta_link,
                            "path": save_path,
                            "error": type(e).__name__,
                        }
                    )
                    console.print(
                        f"[red]Failed mandala {mandala_index + 1} sukta {sukta_index + 1}[/] "
                        f"{type(e).__name__}: {sukta_link}"
                    )

        total_downloaded += mandala_downloaded
        total_skipped += mandala_skipped
        overall_failed.extend(mandala_failed)

        console.print(
            f"[green]Mandala {mandala_index + 1}[/]: "
            f"downloaded={mandala_downloaded}, skipped={mandala_skipped}, failed={len(mandala_failed)}"
        )

    if overall_failed:
        console.print(
            f"[red bold]Download finished with failures: {len(overall_failed)}[/]"
        )
        for item in overall_failed:
            console.print(
                f"[red]- mandala {item['mandala']}, sukta {item['sukta']}, error={item['error']}[/]"
            )
    else:
        console.print(
            f"[green bold]All downloads complete.[/] downloaded={total_downloaded}, skipped={total_skipped}"
        )


if __name__ == "__main__":
    app()
