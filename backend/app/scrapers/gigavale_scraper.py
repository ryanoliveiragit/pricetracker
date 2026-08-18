"""Scraper da Gigavale Atacado (Agile B2B).

O login usa Selenium porque a página é protegida por reCAPTCHA. Depois de
autenticado, os cookies são transferidos para ``requests.Session`` e
persistidos pelo cache de sessões existente. As buscas seguintes não abrem o
navegador enquanto os cookies continuarem válidos.
"""

from __future__ import annotations

import logging
import os
import shutil
import time
from pathlib import Path
from typing import List, Optional

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.models.product import ProductOffer
from app.scrapers.base_scraper import BaseScraper
from app.services.session_cache import (
    get_login_lock,
    get_session,
    invalidate,
    store_session,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gigavaleatacado.com.br"
CACHE_KEY = "gigavale"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
}


class GigavaleScraper(BaseScraper):
    """Busca produtos e preços autenticados na Gigavale Atacado."""

    def __init__(self):
        super().__init__(store_name="Gigavale Atacado", base_url=BASE_URL, timeout=20)
        self.session = self._new_session()
        self.is_logged_in = False

    @staticmethod
    def _new_session() -> requests.Session:
        session = requests.Session()
        session.headers.update(HEADERS)
        retry = Retry(
            total=2,
            connect=2,
            read=2,
            backoff_factor=0.75,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
        )
        session.mount("https://", HTTPAdapter(max_retries=retry))
        return session

    @staticmethod
    def _is_authenticated_html(html: str) -> bool:
        compact = html.replace(" ", "")
        return '"perfil":"cliente"' in compact and '"usuario":""' not in compact

    def _session_is_authenticated(self) -> bool:
        try:
            response = self.session.get(self.base_url + "/", timeout=self.timeout)
            return response.ok and self._is_authenticated_html(response.text)
        except requests.RequestException:
            return False

    @staticmethod
    def _chrome_binary() -> Optional[str]:
        configured = os.getenv("GIGAVALE_CHROME_BINARY") or os.getenv("CHROME_BIN")
        if configured and Path(configured).is_file():
            return configured

        discovered = shutil.which("google-chrome") or shutil.which("chromium")
        if discovered:
            return discovered

        candidates = (
            Path(os.getenv("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.getenv("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.getenv("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
        )
        return next((str(path) for path in candidates if path.is_file()), None)

    def login(self, username: str, password: str) -> bool:
        """Autentica em navegador real e transfere os cookies para requests."""
        self.login_error = None
        if not username or not password:
            self.login_error = "Credenciais da Gigavale não configuradas"
            return False

        try:
            from selenium import webdriver
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.webdriver.support.ui import WebDriverWait
        except ImportError:
            self.login_error = "Selenium não está instalado no backend"
            return False

        options = webdriver.ChromeOptions()
        binary = self._chrome_binary()
        if binary:
            options.binary_location = binary
        for argument in (
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1365,900",
            "--lang=pt-BR",
        ):
            options.add_argument(argument)

        driver = None
        try:
            logger.info("Gigavale: iniciando autenticação protegida")
            driver = webdriver.Chrome(options=options)
            driver.set_page_load_timeout(30)
            driver.get(self.base_url + "/entrar")

            wait = WebDriverWait(driver, 25)
            wait.until(EC.visibility_of_element_located((By.NAME, "email"))).send_keys(username)
            driver.find_element(By.NAME, "senha").send_keys(password)
            driver.find_element(By.CSS_SELECTOR, "button.g-recaptcha").click()

            wait.until(
                lambda browser: (
                    "/entrar" not in browser.current_url
                    and self._is_authenticated_html(browser.page_source)
                )
            )

            authenticated = self._new_session()
            authenticated.headers["User-Agent"] = driver.execute_script(
                "return navigator.userAgent"
            )
            for cookie in driver.get_cookies():
                authenticated.cookies.set(
                    cookie["name"],
                    cookie["value"],
                    domain=cookie.get("domain"),
                    path=cookie.get("path", "/"),
                )

            self.session = authenticated
            self.is_logged_in = self._session_is_authenticated()
            if not self.is_logged_in:
                self.login_error = "A Gigavale não confirmou a sessão autenticada"
                return False

            logger.info("Gigavale: autenticação concluída")
            return True
        except Exception as exc:
            logger.warning("Gigavale: autenticação falhou (%s)", type(exc).__name__)
            self.login_error = (
                "Não foi possível autenticar na Gigavale. "
                "Verifique as credenciais e a disponibilidade do reCAPTCHA."
            )
            return False
        finally:
            if driver is not None:
                try:
                    driver.quit()
                except Exception:
                    logger.debug("Gigavale: falha ao encerrar o navegador", exc_info=True)

    def _ensure_authenticated(self, username: str, password: str) -> bool:
        cached = get_session(CACHE_KEY, username)
        if cached is not None:
            self.session = cached
            self.session.headers.update(HEADERS)
            if self._session_is_authenticated():
                self.is_logged_in = True
                return True
            invalidate(CACHE_KEY)

        with get_login_lock(CACHE_KEY):
            cached = get_session(CACHE_KEY, username)
            if cached is not None:
                self.session = cached
                self.session.headers.update(HEADERS)
                if self._session_is_authenticated():
                    self.is_logged_in = True
                    return True
                invalidate(CACHE_KEY)

            if not self.login(username, password):
                return False
            store_session(CACHE_KEY, username, self.session)
            return True

    @staticmethod
    def _scope_for(info: Tag) -> Tag:
        return info.find_parent("tr") or info.find_parent(class_="product-card") or info

    def _parse_products(self, html: str) -> List[ProductOffer]:
        soup = BeautifulSoup(html, "html.parser")
        products: dict[str, ProductOffer] = {}

        for info in soup.select(".product-card__info[data-id-produto][data-nome]"):
            sku = (info.get("data-codigo-produto") or info.get("data-id-produto") or "").strip()
            name = (info.get("data-nome") or "").strip()
            if not sku or not name:
                continue

            try:
                price = float((info.get("data-preco") or "0").replace(",", "."))
            except ValueError:
                price = 0.0
            if price <= 0:
                continue

            scope = self._scope_for(info)
            link = info.select_one(".product-card__name a[href]") or scope.select_one("a[href]")
            product_url = link.get("href", "") if link else ""
            if product_url and not product_url.startswith("http"):
                product_url = self.base_url.rstrip("/") + "/" + product_url.lstrip("/")

            image = scope.select_one("img")
            image_url = ""
            if image:
                image_url = image.get("data-src") or image.get("src") or ""

            legends = [
                element.get_text(" ", strip=True)
                for element in info.select(".product-card__rating-legend")
            ]
            packaging = next(
                (text.split(":", 1)[1].strip() for text in legends if text.lower().startswith("embalagem:")),
                "",
            )
            department = (info.get("data-departamento") or "").strip()
            description = " · ".join(part for part in (department, packaging) if part) or None

            quantity = scope.select_one("input[name^='quantidade']")
            full_text = scope.get_text(" ", strip=True).lower()
            unavailable = (
                quantity is None
                or quantity.has_attr("disabled")
                or any(term in full_text for term in ("indisponível", "esgotado", "sem estoque"))
            )

            products[sku] = ProductOffer(
                store=self.store_name,
                product_name=name,
                price=price,
                currency="BRL",
                product_url=product_url,
                add_to_cart_url=product_url,
                availability="indisponivel" if unavailable else "em_estoque",
                sku=sku,
                image_url=image_url or None,
                description=description,
                brand=(info.get("data-marca") or "").strip() or None,
            )

        return list(products.values())

    def search(
        self,
        query: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        **_,
    ) -> List[ProductOffer]:
        self.login_error = None
        if not username or not password:
            self.login_error = "Credenciais da Gigavale não configuradas"
            return []
        if not self._ensure_authenticated(username, password):
            return []

        try:
            time.sleep(0.5)
            response = self.session.get(
                self.base_url + "/busca",
                params={"s": query.strip()},
                headers={"Referer": self.base_url + "/"},
                timeout=self.timeout,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            self.record_failure()
            logger.warning("Gigavale: busca falhou (%s)", type(exc).__name__)
            return []

        if not self._is_authenticated_html(response.text):
            invalidate(CACHE_KEY)
            self.is_logged_in = False
            self.login_error = "Sessão da Gigavale expirou; tente a busca novamente"
            return []

        offers = self._parse_products(response.text)
        self.record_success()
        logger.info("Gigavale: %d produtos encontrados", len(offers))
        return self._rank_results(query, offers, limit=None)
