import logging
import time
import urllib.parse
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "keep-alive",
}


def make_dynamic_class(config_dict: dict) -> type:
    """Returns a class (not instance) configured for this supplier — compatible with scraper_class()."""
    class _Configured(DynamicScraper):
        def __init__(self):
            super().__init__(config_dict)
    store = config_dict.get("store_name", "Loja").replace(" ", "_")
    _Configured.__name__ = f"Dynamic_{store}"
    return _Configured


class DynamicScraper(BaseScraper):
    """CSS selector-based scraper configured via the admin UI."""

    def __init__(self, config: dict):
        super().__init__(
            store_name=config.get("store_name", "Loja"),
            base_url=config.get("base_url", ""),
        )
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(_HEADERS)
        self.is_logged_in = False
        self.login_error: Optional[str] = None

    # ── Login ─────────────────────────────────────────────────────────────────

    def login(self, username: str, password: str) -> bool:
        login_url = self.config.get("login_url", "")
        if not login_url:
            self.is_logged_in = True
            return True
        try:
            r = self.session.get(login_url, timeout=15)
            r.raise_for_status()

            csrf = ""
            csrf_field = "_token"
            csrf_sel = self.config.get("login_csrf_selector", "")
            if csrf_sel:
                soup = BeautifulSoup(r.text, "html.parser")
                inp = soup.select_one(csrf_sel)
                if inp:
                    csrf = inp.get("value", "")
                    csrf_field = inp.get("name", "_token")

            time.sleep(1)

            submit_url = self.config.get("login_submit_url", "") or login_url
            post_data = {
                self.config.get("login_username_field", "email"): username,
                self.config.get("login_password_field", "password"): password,
            }
            if csrf:
                post_data[csrf_field] = csrf

            resp = self.session.post(
                submit_url,
                data=post_data,
                headers={"Referer": login_url},
                timeout=15,
                allow_redirects=True,
            )

            check = self.config.get("login_success_check", "url")
            value = self.config.get("login_success_value", "login")

            if check == "url":
                success = value.lower() not in resp.url.lower()
            elif check == "element":
                success = bool(BeautifulSoup(resp.text, "html.parser").select_one(value))
            elif check == "json":
                try:
                    success = bool(resp.json().get(value))
                except Exception:
                    success = False
            else:
                success = resp.ok

            if success:
                self.is_logged_in = True
                return True

            self.login_error = "Usuário ou senha inválidos"
            return False

        except Exception as e:
            self.login_error = f"Erro de conexão: {e}"
            return False

    # ── Search ────────────────────────────────────────────────────────────────

    def search(self, query: str, username: str = "", password: str = "", region: str = "sp") -> List[ProductOffer]:
        requires_login = self.config.get("requires_login", False)
        cache_key = self.config.get("cache_key", f"dyn_{self.config.get('supplier_id', 'x')[:8]}")

        if requires_login:
            if username and password:
                from app.services.session_cache import get_login_lock, get_session, store_session
                cached = get_session(cache_key, username)
                if cached:
                    self.session = cached
                    self.is_logged_in = True
                else:
                    with get_login_lock(cache_key):
                        cached = get_session(cache_key, username)
                        if cached:
                            self.session = cached
                            self.is_logged_in = True
                        else:
                            if self.login(username, password) and self.is_logged_in:
                                store_session(cache_key, username, self.session)
            if not self.is_logged_in:
                return []
        else:
            self.is_logged_in = True

        search_url_tpl = self.config.get("search_url", "")
        if not search_url_tpl:
            return []

        try:
            url = search_url_tpl.replace("{query}", urllib.parse.quote(query))
            r = self.session.get(url, timeout=10)
            r.raise_for_status()
        except Exception as e:
            logger.error("DynamicScraper fetch error [%s]: %s", self.store_name, e)
            self.record_failure()
            return []

        soup = BeautifulSoup(r.text, "html.parser")
        c_sel = self.config.get("container_selector", "")
        n_sel = self.config.get("name_selector", "")
        p_sel = self.config.get("price_selector", "")
        l_sel = self.config.get("link_selector", "a")
        i_sel = self.config.get("image_selector", "")
        s_sel = self.config.get("sku_selector", "")
        base = self.config.get("base_url", "").rstrip("/")

        if not c_sel or not n_sel or not p_sel:
            logger.warning("DynamicScraper: seletores incompletos para '%s'", self.store_name)
            return []

        offers: List[ProductOffer] = []
        for card in soup.select(c_sel)[:100]:
            name_el = card.select_one(n_sel)
            price_el = card.select_one(p_sel)
            if not name_el or not price_el:
                continue

            name = name_el.get_text(strip=True)
            price = self._extract_price(price_el.get_text(strip=True))

            href = ""
            if l_sel:
                link_el = card.select_one(l_sel)
                if link_el:
                    href = link_el.get("href", "")
                    if href and not href.startswith("http"):
                        href = base + "/" + href.lstrip("/")

            img_url = ""
            if i_sel:
                img_el = card.select_one(i_sel)
                if img_el:
                    img_url = img_el.get("src", "") or img_el.get("data-src", "")

            sku = ""
            if s_sel:
                sku_el = card.select_one(s_sel)
                if sku_el:
                    sku = sku_el.get_text(strip=True)

            offers.append(ProductOffer(
                store=self.store_name,
                product_name=name,
                price=price,
                currency="BRL",
                availability="em_estoque",
                product_url=href,
                image_url=img_url,
                sku=sku,
                brand="",
                unit="un",
            ))

        logger.info("DynamicScraper [%s]: %d resultados para '%s'", self.store_name, len(offers), query)
        return self._rank_results(query, offers)
