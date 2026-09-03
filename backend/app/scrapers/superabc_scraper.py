"""Scraper da Super ABC Distribuidora.

A loja roda em OpenCart com um tema Vue próprio. O login antigo por formulário
(``POST /conta/acessar``) deixou de existir: hoje é um endpoint AJAX
(``index.php?route=account/login/login``) que recebe os campos ``login`` e
``password`` e responde JSON. A busca também mudou para
``index.php?route=product/search`` e os produtos são renderizados no servidor
com marcadores ``data-product-id`` / ``data-product="name"`` / ``data-product="model"``.
"""

from typing import List, Optional
import json
import logging
import re
import urllib.parse
from decimal import Decimal, InvalidOperation

import requests
import urllib3
from bs4 import BeautifulSoup

from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer
from app.services.session_cache import get_session, store_session, invalidate

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://superabcdistribuidora.com.br"
CACHE_KEY = "superabc"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    # NÃO anunciar brotli ("br"): o backend pode não ter o decodificador brotli
    # instalado, e aí as respostas voltam como bytes comprimidos ilegíveis, o
    # que quebrava tanto o login (JSON) quanto a busca (HTML).
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


class SuperABCScraper(BaseScraper):
    """Scraper para Super ABC Distribuidora (OpenCart + tema Vue)."""

    LOGIN_PAGE = "/index.php?route=account/login"
    LOGIN_ENDPOINT = "/index.php?route=account/login/login"
    SEARCH_ENDPOINT = "/index.php?route=product/search"
    MAX_PAGES = 3

    def __init__(self):
        super().__init__(
            store_name="Super ABC Distribuidora",
            base_url=DEFAULT_BASE_URL,
            timeout=20,
        )
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.is_logged_in = False
        self.login_error: Optional[str] = None

    # ── Preço ────────────────────────────────────────────────────────────────
    @staticmethod
    def _parse_price(raw: object) -> float:
        """Interpreta valores em formato brasileiro (R$ 1.234,56) ou simples."""
        if raw is None:
            return 0.0
        text = str(raw).replace("R$", "").replace("\xa0", " ").strip()
        match = re.search(r"\d[\d.,]*", text)
        if not match:
            return 0.0
        token = match.group(0)
        if "," in token and "." in token:
            token = token.replace(".", "").replace(",", ".")
        elif "," in token:
            token = token.replace(",", ".")
        elif token.count(".") > 1:
            token = token.replace(".", "")
        try:
            value = Decimal(token)
        except (InvalidOperation, ValueError):
            return 0.0
        return float(value) if value > 0 else 0.0

    # ── Login ────────────────────────────────────────────────────────────────
    def login(self, username: str, password: str) -> bool:
        self.login_error = None
        if not username or not password:
            self.login_error = "Credenciais da Super ABC não configuradas"
            return False

        try:
            # 1) GET da página de login para obter o cookie de sessão (OCSESSID).
            self.session.get(
                self.base_url + self.LOGIN_PAGE, timeout=self.timeout, verify=False
            )

            # 2) POST AJAX de autenticação. O campo é "login" (e-mail/CNPJ), não "email".
            resp = self.session.post(
                self.base_url + self.LOGIN_ENDPOINT,
                data={"login": username, "password": password},
                headers={
                    **self.session.headers,
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": self.base_url + "/conta/acessar",
                    "Origin": self.base_url,
                    "Accept": "application/json, text/plain, */*",
                },
                timeout=self.timeout,
                verify=False,
            )

            try:
                data = resp.json()
            except (json.JSONDecodeError, ValueError):
                low = resp.text.lower()
                if "limite de tentativas" in low or "excedeu" in low:
                    self.login_error = (
                        "Conta bloqueada temporariamente — muitas tentativas de login."
                    )
                else:
                    self.login_error = "Resposta inesperada da Super ABC no login"
                logger.error("SuperABC: login sem JSON (HTTP %s)", resp.status_code)
                invalidate(CACHE_KEY)
                return False

            status = str(data.get("status", "")).lower()
            messages = data.get("messages") or []
            message = "; ".join(str(m) for m in messages) if isinstance(messages, list) else str(messages)

            if status == "success":
                self.is_logged_in = True
                logger.info("SuperABC: login OK")
                return True

            if "turnstile" in message.lower() or "verificação de segurança" in message.lower():
                self.login_error = (
                    "A Super ABC exigiu verificação de segurança (Cloudflare Turnstile) "
                    "que não é possível resolver automaticamente."
                )
            elif status == "not_found":
                self.login_error = "Conta não encontrada na Super ABC — verifique o login"
            elif message:
                self.login_error = f"A Super ABC recusou o login: {message}"
            else:
                self.login_error = "Login falhou — verifique as credenciais da Super ABC"

            logger.error("SuperABC: %s", self.login_error)
            invalidate(CACHE_KEY)
            return False

        except requests.RequestException as e:
            self.login_error = "Não foi possível conectar à Super ABC"
            logger.error("SuperABC login erro de rede: %s", type(e).__name__)
            return False

    # ── Busca ────────────────────────────────────────────────────────────────
    def _fetch_page(self, query: str, page: int = 1) -> Optional[BeautifulSoup]:
        # A barra de "route=product/search" NÃO pode ser codificada (%2F): o
        # roteador do OpenCart não a decodifica e devolve a home. Por isso
        # montamos a query manualmente e só escapamos o termo de busca.
        url = (
            self.base_url
            + "/index.php?route=product/search&search="
            + urllib.parse.quote(query)
            + "&limit=100"
        )
        if page > 1:
            url += f"&page={page}"
        try:
            resp = self.session.get(
                url,
                timeout=self.timeout,
                verify=False,
                headers={"Referer": self.base_url + "/"},
            )
            logger.info("SuperABC GET %s → %s | %s chars", url, resp.status_code, len(resp.text))
            if resp.status_code != 200:
                return None
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            logger.error("SuperABC: erro ao buscar página %s: %s", page, type(e).__name__)
            return None

    def _parse_products(self, soup: BeautifulSoup, page: int) -> List[dict]:
        products: List[dict] = []
        cards = soup.select("[data-product-id]")
        logger.info("SuperABC: %s cards na página %s", len(cards), page)

        for card in cards:
            try:
                name_tag = card.select_one('a[data-product="name"]') or card.select_one("a[href]")
                if not name_tag:
                    continue

                raw_name = name_tag.get_text(" ", strip=True)
                model_tag = card.select_one('[data-product="model"]')
                sku = (model_tag.get_text(strip=True) if model_tag else "") or card.get("data-product-id") or ""
                sku = sku.strip()

                # O nome vem como "<código> - NOME"; removemos o prefixo do código.
                name = raw_name
                if sku and name.startswith(sku):
                    name = re.sub(r"^\s*" + re.escape(sku) + r"\s*-\s*", "", name).strip()
                else:
                    name = re.sub(r"^\s*\d+\s*-\s*", "", name).strip()
                if len(name) < 2:
                    continue

                product_url = name_tag.get("href", "") or ""
                if product_url and not product_url.startswith("http"):
                    product_url = self.base_url + "/" + product_url.lstrip("/")

                img_tag = card.select_one("img")
                image_url = None
                if img_tag:
                    image_url = img_tag.get("data-src") or img_tag.get("src")

                # Preço: o tema marca o valor logado com data-product="price".
                price = 0.0
                price_tag = card.select_one('[data-product="price"]')
                if price_tag:
                    price = self._parse_price(price_tag.get_text(" ", strip=True))
                if price <= 0:
                    for el in card.find_all(["span", "div", "strong", "b", "p"]):
                        txt = el.get_text(" ", strip=True)
                        if "R$" in txt and len(txt) < 40:
                            price = self._parse_price(txt)
                            if price > 0:
                                break

                # Disponibilidade: o card revela o estado por atributos data-bt-*.
                unavailable_tag = card.select_one("[data-bt-unavailable]")
                unavailable_visible = bool(
                    unavailable_tag and "hidden" not in (unavailable_tag.get("class") or [])
                )
                full_text = card.get_text(" ", strip=True).lower()
                availability = (
                    "indisponivel"
                    if unavailable_visible
                    or any(w in full_text for w in ("indispon", "esgotado", "sem estoque"))
                    else "em_estoque"
                )

                products.append({
                    "product_name": name,
                    "product_url": product_url,
                    "image_url": image_url,
                    "price": price,
                    "availability": availability,
                    "sku": sku or None,
                })
            except Exception as e:
                logger.debug("SuperABC: erro ao parsear card: %s", e)

        logger.info("SuperABC: %s produtos extraídos na página %s", len(products), page)
        return products

    def search(
        self,
        query: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        **_,
    ) -> List[ProductOffer]:
        offers: List[ProductOffer] = []
        try:
            logger.info("SuperABC | query: '%s'", query)

            if username and password:
                cached = get_session(CACHE_KEY, username)
                if cached:
                    self.session = cached
                    self.session.headers.update(HEADERS)
                    self.is_logged_in = True
                    logger.info("SuperABC: reutilizando sessão cacheada")
                else:
                    if not self.login(username, password):
                        return []
                    store_session(CACHE_KEY, username, self.session)
            else:
                logger.info("SuperABC: sem credenciais — buscando como visitante")

            page = 1
            total_products: List[dict] = []
            while page <= self.MAX_PAGES:
                soup = self._fetch_page(query, page)
                if not soup:
                    break
                products = self._parse_products(soup, page)
                if not products:
                    break
                total_products.extend(products)
                page += 1

            seen = set()
            for p in total_products:
                key = p.get("sku") or p["product_url"]
                if key and key not in seen:
                    seen.add(key)
                    offers.append(ProductOffer(
                        store=self.store_name,
                        product_name=p["product_name"],
                        price=p["price"],
                        currency="BRL",
                        product_url=p["product_url"],
                        add_to_cart_url=p["product_url"],
                        availability=p["availability"],
                        sku=p.get("sku"),
                        image_url=p.get("image_url"),
                    ))

            offers = self._rank_results(query, offers, limit=None)
            logger.info("SuperABC: %s produtos retornados", len(offers))

        except Exception as e:
            logger.error("Erro crítico SuperABC: %s", e, exc_info=True)
            invalidate(CACHE_KEY)

        return offers
