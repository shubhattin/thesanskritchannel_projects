import os
import json
import requests
from pyquery import PyQuery
from rich.console import Console
import typer

app = typer.Typer()
console = Console()

HOSTNAME = "https://vedicheritage.gov.in"
SHAKALA_SAMHITA_MANDALA_LIST_PAGE = (
    "https://vedicheritage.gov.in/samhitas/rigveda/shakala-samhita/"
)
USER_AGENT_HEADER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}


@app.command()
def get_links_json():
    """
    Get links for all the mandalas and the corresponding suktas under them
    """
    mandala_links: list[str] = []
    MANDA_LIST_CACHE_FILE = "json_url_cache/shakala_samhita_mandala_list.json"
    if os.path.exists(MANDA_LIST_CACHE_FILE):
        mandala_links = json.load(open(MANDA_LIST_CACHE_FILE))
    else:
        req = requests.get(SHAKALA_SAMHITA_MANDALA_LIST_PAGE, headers=USER_AGENT_HEADER)
        html = PyQuery(req.text)
        mandala_list = html("#cn-wrapper.cn-wrapper > ul > li > a")
        for mandala in mandala_list.items():
            url = mandala.attr("href")
            # ^ The url is a redirected url resolve it
            resolved_url = requests.get(HOSTNAME + url, headers=USER_AGENT_HEADER).url
            console.print(resolved_url)
            mandala_links.append(resolved_url)
        json.dump(mandala_links, open(MANDA_LIST_CACHE_FILE, "w"), indent=2)

    for i, mandala_link in enumerate(mandala_links):
        SUKTA_CACHE_FILE = f"json_url_cache/sukta/{i + 1}.json"
        sukat_list: list[str] = []
        if os.path.exists(SUKTA_CACHE_FILE):
            sukat_list = json.load(open(SUKTA_CACHE_FILE))
        else:
            console.print(f"Fetching suktas for mandala {i + 1}", mandala_link)
            req = requests.get(mandala_link, headers=USER_AGENT_HEADER)
            html = PyQuery(req.text)
            sukta_list = html(
                "html body.wp-singular.page-template.page-template-mandal-template.page-template-mandal-template-php.page.page-id-343.page-parent.page-child.parent-pageid-38.wp-theme-vedic.class-name.groovy_menu_1-4-3.single-author div#page.hfeed.site div#main.site-main div#primary.content-area div#content.site-content div.container div.row div.col-lg-3.col-md-3.col-sm-3 div.row div.primewp-side-widget.widget.primewp-box.widget_black_studio_tinymce div.primewp-box-inside div.primewp-widget-header div ul.mandalbtn.mandallinks-scrolling > li > a"
            )
            for sukta in sukta_list.items():
                url = requests.get(
                    HOSTNAME + sukta.attr("href"), headers=USER_AGENT_HEADER
                ).url
                console.print(sukta.attr("href"), url)
                sukat_list.append(url)
            if len(sukat_list) > 0:
                json.dump(sukat_list, open(SUKTA_CACHE_FILE, "w"), indent=2)


if __name__ == "__main__":
    app()
