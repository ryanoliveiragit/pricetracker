"""Scraper da Gigavale Atacado (Agile B2B).

O login usa Selenium porque a página é protegida por reCAPTCHA. Depois de
autenticado, os cookies são transferidos para ``requests.Session`` e
persistidos pelo cache de sessões existente. As buscas seguintes não abrem o
navegador enquanto os cookies continuarem válidos.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import List, Optional
from urllib.parse import urljoin

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
        """Detect the logged-in marker emitted by the Gigavale layout."""
        profile = re.search(r'"perfil"\s*:\s*"cliente"', html, re.IGNORECASE)
        empty_user = re.search(r'"usuario"\s*:\s*""', html, re.IGNORECASE)
        return profile is not None and empty_user is None

    @staticmethod
    def _parse_price(raw_price: object) -> float:
        """Parse Brazilian or HTML numeric price values without locale mistakes."""
        if raw_price is None:
            return 0.0
        text = str(raw_price).strip().replace("R$", "").replace(" ", "")
        match = re.search(r"[-+]?\d[\d.,]*", text)
        if not match:
            return 0.0
        token = match.group(0)
        if "," in token and "." in token:
            # The last separator is the decimal separator (1.234,56 / 1,234.56).
            if token.rfind(",") > token.rfind("."):
                token = token.replace(".", "").replace(",", ".")
            else:
                token = token.replace(",", "")
        elif "," in token:
            token = token.replace(",", ".")
        elif token.count(".") > 1:
            token = token.replace(".", "")
        try:
            value = Decimal(token)
        except (InvalidOperation, ValueError):
            return 0.0
        return float(value) if value > 0 else 0.0

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

    @staticmethod
    def _create_driver(webdriver, options):
        """Create a local Chrome driver or use a configured Selenium Grid."""
        remote_url = os.getenv("SELENIUM_REMOTE_URL")
        if remote_url:
            logger.info("Gigavale: usando WebDriver remoto configurado")
            return webdriver.Remote(command_executor=remote_url, options=options)
        return webdriver.Chrome(options=options)

    def login(self, username: str, password: str) -> bool:
        """Autentica em navegador real e transfere os cookies para requests."""
        self.login_error = None
        if not username or not password:
            self.login_error = "Credenciais da Gigavale não configuradas"
            return False

        try:
            from selenium import webdriver
            from selenium.webdriver.common.by import By
            from selenium.common.exceptions import TimeoutException, WebDriverException
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
            "--disable-extensions",
            "--disable-gpu",
            "--remote-debugging-pipe",
            "--window-size=1365,900",
            "--lang=pt-BR",
        ):
            options.add_argument(argument)

        driver = None
        try:
            logger.info("Gigavale: iniciando autenticação protegida")
            driver = self._create_driver(webdriver, options)
            driver.set_page_load_timeout(30)
            driver.get(self.base_url + "/entrar")

            # The cookie banner can cover the reCAPTCHA button on a fresh browser.
            try:
                WebDriverWait(driver, 4).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button.acceptcookies"))
                ).click()
            except TimeoutException:
                pass

            wait = WebDriverWait(driver, 30)
            wait.until(EC.visibility_of_element_located((By.NAME, "email"))).send_keys(username)
            wait.until(EC.visibility_of_element_located((By.NAME, "senha"))).send_keys(password)
            submit = wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button.g-recaptcha"))
            )
            # JavaScript click avoids occasional overlay interception after reCAPTCHA loads.
            driver.execute_script("arguments[0].click();", submit)

            wait.until(
                lambda browser: self._is_authenticated_html(browser.page_source)
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
        except TimeoutException:
            self.is_logged_in = False
            self.login_error = (
                "A Gigavale não confirmou o login no tempo esperado. "
                "O reCAPTCHA pode ter bloqueado a tentativa."
            )
            return False
        except WebDriverException as exc:
            self.is_logged_in = False
            logger.exception(
                "Gigavale: Chrome/WebDriver não iniciou (%s)",
                type(exc).__name__,
            )
            if os.getenv("SELENIUM_REMOTE_URL"):
                self.login_error = (
                    "Não foi possível conectar ao navegador remoto da Gigavale. "
                    "Verifique SELENIUM_REMOTE_URL."
                )
            elif not binary:
                self.login_error = (
                    "Chrome/Chromium não foi encontrado no backend. "
                    "Use a imagem Docker do projeto ou configure SELENIUM_REMOTE_URL."
                )
            else:
                self.login_error = (
                    "O Chrome foi encontrado, mas o WebDriver não iniciou. "
                    "Verifique a compatibilidade do ChromeDriver nos logs do backend."
                )
            return False
        except Exception as exc:
            self.is_logged_in = False
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

            price = self._parse_price(info.get("data-preco"))
            if price <= 0:
                continue

            scope = self._scope_for(info)
            link = info.select_one(".product-card__name a[href]") or scope.select_one("a[href]")
            product_url = link.get("href", "") if link else ""
            if product_url:
                product_url = urljoin(self.base_url.rstrip("/") + "/", product_url)

            image = scope.select_one("img")
            image_url = ""
            if image:
                image_url = image.get("data-src") or image.get("src") or ""
                if image_url:
                    image_url = urljoin(self.base_url.rstrip("/") + "/", image_url)

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
        query = " ".join((query or "").split())
        if not query:
            self.login_error = "Consulta de produto vazia"
            return []
        if not username or not password:
            self.login_error = "Credenciais da Gigavale não configuradas"
            return []
        if not self._ensure_authenticated(username, password):
            return []

        try:
            response = self.session.get(
                self.base_url + "/busca",
                params={"s": query},
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
            self.record_failure()
            return []

        offers = self._parse_products(response.text)
        self.record_success()
        logger.info("Gigavale: %d produtos encontrados", len(offers))
        return self._rank_results(query, offers, limit=None)
