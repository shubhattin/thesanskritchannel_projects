import os
import json
import random
import time
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

_LAST_REQUEST_AT = 0.0


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def _throttle() -> None:
    """
    Ensure a minimum spacing between outgoing requests, with jitter.
    This helps avoid 'Connection reset by peer' from bursty traffic.
    """
    global _LAST_REQUEST_AT
    now = time.monotonic()
    wait = (_LAST_REQUEST_AT + MIN_REQUEST_INTERVAL_S) - now
    if wait > 0:
        time.sleep(wait)
    if JITTER_S > 0:
        time.sleep(random.random() * JITTER_S)
    _LAST_REQUEST_AT = time.monotonic()


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


SESSION = _build_session()


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
        _throttle()
        try:
            resp = SESSION.get(url, timeout=DEFAULT_TIMEOUT, allow_redirects=True)
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
def get_links_json():
    """
    Get links for all the mandalas and the corresponding suktas under them
    """
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
        for sukta_index, sukta_link in enumerate(sukat_list):
            HTML_SAVE_URL = (
                f"../raw_data/1/1/{mandala_index + 1}/{sukta_index + 1}.html"
            )


if __name__ == "__main__":
    app()
