"""Scraper da Cofema Atacadista.

O site foi reconstruído em Next.js e a API antiga em ASP.NET MVC
(``/Home/Logon``, ``__RequestVerificationToken``, ``/Produto/Listar/Busca``)
deixou de existir. Hoje a aplicação conversa com uma API RPC própria:

    POST /api/auth      {"action": "loginCliente", "codigoOuCnpj": ..., "pass": ...}
    POST /api/produto   {"action": "searchProdutos", "searchTerm": ..., ...}

Cada resposta é JSON. Após o login, o cookie de sessão fica na ``requests.Session``
e os preços do cliente passam a vir preenchidos na busca.
"""

from typing import List, Optional
import json
import logging

import requests
import urllib3

from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer
from app.services.session_cache import (
    get_session,
    store_session,
    invalidate,
    get_login_lock,
)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cofema.com.br"
CACHE_KEY = "cofema"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    # Sem brotli ("br"): o backend pode não ter o decodificador, e a resposta
    # voltaria como bytes ilegíveis.
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
    "Origin": BASE_URL,
    "Referer": BASE_URL + "/",
}

# Campos possíveis para nome e preço no objeto de produto (a API varia conforme
# tabela de preço do cliente); usamos o primeiro que estiver preenchido.
NAME_FIELDS = ("descricao", "descricaoProduto", "nome", "nomeProduto", "titulo")
PRICE_FIELDS = (
    "precoVendaCliente",
    "precoFinal",
    "precoAplicado",
    "precoVenda",
    "precoPromocional",
    "preco",
    "valorUnitario",
)
SKU_FIELDS = ("codigo", "codigoProduto", "produtoCodigo", "id", "idProduto")
IMAGE_FIELDS = ("imagem", "imagemUrl", "urlImagem", "foto")


class CofemaScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Cofema Materiais", base_url=BASE_URL, timeout=20)
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self._logged_in = False

    # ── Login ────────────────────────────────────────────────────────────────
    def login(self, username: str, password: str) -> bool:
        return self._do_login(username, password)

    def _do_login(self, username: str, password: str) -> bool:
        self.login_error = None
        if not username or not password:
            self.login_error = "Credenciais da Cofema não configuradas"
            return False
        try:
            r = self.session.post(
                f"{BASE_URL}/api/auth",
                data=json.dumps(
                    {"action": "loginCliente", "codigoOuCnpj": username, "pass": password}
                ),
                timeout=self.timeout,
                verify=False,
            )
            if r.status_code == 429:
                self.login_error = "Cofema bloqueou o IP (429) — muitas tentativas"
                logger.warning("Cofema: 429 no login")
                return False

            try:
                data = r.json()
            except (json.JSONDecodeError, ValueError):
                self.login_error = "Resposta inesperada da Cofema no login"
                logger.error("Cofema: login sem JSON (HTTP %s)", r.status_code)
                return False

            if data.get("success"):
                self._logged_in = True
                logger.info("Cofema: login OK")
                return True

            if data.get("resetPasswordOnNextLogin"):
                self.login_error = (
                    "A Cofema exige troca de senha antes do próximo login"
                )
            else:
                self.login_error = (
                    data.get("error")
                    or data.get("message")
                    or "Login falhou — verifique as credenciais da Cofema"
                )
            logger.warning("Cofema: %s", self.login_error)
            return False

        except requests.RequestException as e:
            self.login_error = "Não foi possível conectar à Cofema"
            logger.error("Cofema login erro de rede: %s", type(e).__name__)
            return False

    def search(self, query: str, username: str = "", password: str = "", **kwargs) -> List[ProductOffer]:
        self.login_error = None
        try:
            if username and password:
                cached = get_session(CACHE_KEY, username)
                if cached:
                    self.session = cached
                    self.session.headers.update(HEADERS)
                    self._logged_in = True
                else:
                    with get_login_lock(CACHE_KEY):
                        cached = get_session(CACHE_KEY, username)
                        if cached:
                            self.session = cached
                            self.session.headers.update(HEADERS)
                            self._logged_in = True
                        else:
                            self._do_login(username, password)
                            if self._logged_in:
                                store_session(CACHE_KEY, username, self.session)

            if not self._logged_in:
                logger.warning("Cofema: sem sessão ativa — pulando busca para '%s'", query)
                return []

            return self._search(query)
        except Exception as e:
            logger.error("Cofema search error: %s", e, exc_info=True)
            invalidate(CACHE_KEY)
            return []

    # ── Busca ────────────────────────────────────────────────────────────────
    def _search(self, query: str) -> List[ProductOffer]:
        try:
            r = self.session.post(
                f"{BASE_URL}/api/produto",
                data=json.dumps(
                    {
                        "action": "searchProdutos",
                        "searchTerm": query,
                        "limit": 100,
                        "top": 100,
                        "page": 1,
                    }
                ),
                timeout=self.timeout,
                verify=False,
            )
            if r.status_code == 401:
                # sessão expirou
                invalidate(CACHE_KEY)
                self._logged_in = False
                self.login_error = "Sessão da Cofema expirou; refaça a busca"
                return []
            r.raise_for_status()
            data = r.json()
        except (requests.RequestException, json.JSONDecodeError, ValueError) as e:
            logger.error("Cofema: erro na busca: %s", type(e).__name__)
            return []

        produtos = data.get("produtos") if isinstance(data, dict) else data
        if not isinstance(produtos, list):
            return []

        offers: List[ProductOffer] = []
        seen = set()
        for p in produtos:
            offer = self._to_offer(p)
            if offer is None:
                continue
            key = offer.sku or offer.product_name[:40].lower()
            if key in seen:
                continue
            seen.add(key)
            offers.append(offer)

        offers = self._rank_results(query, offers, limit=None)
        logger.info("Cofema: %s produtos retornados", len(offers))
        return offers

    @staticmethod
    def _first(product: dict, fields) -> object:
        for f in fields:
            if f in product and product[f] not in (None, "", 0):
                return product[f]
        return None

    def _to_offer(self, product: dict) -> Optional[ProductOffer]:
        if not isinstance(product, dict):
            return None
        name = self._first(product, NAME_FIELDS)
        if not name:
            return None
        name = str(name).strip()

        sku = self._first(product, SKU_FIELDS)
        sku = str(sku).strip() if sku is not None else None

        price = 0.0
        raw_price = self._first(product, PRICE_FIELDS)
        if raw_price is not None:
            try:
                price = float(str(raw_price).replace("R$", "").replace(".", "").replace(",", ".").strip()) \
                    if isinstance(raw_price, str) else float(raw_price)
            except (ValueError, TypeError):
                price = 0.0

        image = self._first(product, IMAGE_FIELDS)
        image_url = str(image).strip() if image else None
        if image_url and not image_url.startswith("http"):
            image_url = BASE_URL + "/" + image_url.lstrip("/")

        product_url = f"{BASE_URL}/page/produto/{sku}" if sku else BASE_URL

        unidade = product.get("unidade")
        description = f"Unidade: {unidade}" if unidade else None

        # Disponibilidade: alguns retornos trazem estoque/saldo/disponivel.
        estoque = product.get("estoque", product.get("saldo"))
        disponivel = product.get("disponivel")
        unavailable = (disponivel is False) or (isinstance(estoque, (int, float)) and estoque <= 0)

        return ProductOffer(
            store=self.store_name,
            product_name=name,
            price=price,
            currency="BRL",
            product_url=product_url,
            add_to_cart_url=product_url,
            availability="indisponivel" if unavailable else "em_estoque",
            sku=sku,
            image_url=image_url,
            description=description,
            brand=(str(product.get("marca")).strip() if product.get("marca") else None),
        )
