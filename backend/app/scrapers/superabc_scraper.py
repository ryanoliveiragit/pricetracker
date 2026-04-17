from typing import List, Optional
import requests
from bs4 import BeautifulSoup
import urllib.parse
import logging
import urllib3
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
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


class SuperABCScraper(BaseScraper):
    """
    Scraper para Super ABC Distribuidora (plataforma própria).
    Login: POST /conta/acessar  |  Busca: GET /busca?q=
    """

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

    def login(self, username: str, password: str) -> bool:
        login_url = f"{self.base_url}/conta/acessar"
        logger.info(f"Login SuperABC | user: {username}")
        try:
            # GET para pegar cookies iniciais
            r = self.session.get(login_url, timeout=10, verify=False)

            # Detectar bloqueio por tentativas excessivas
            if "limite de tentativas" in r.text.lower() or "excedeu" in r.text.lower():
                self.login_error = "Conta bloqueada temporariamente — muitas tentativas de login. Tente após 1 hora."
                logger.error(f"SuperABC bloqueada: {self.login_error}")
                invalidate(CACHE_KEY)
                return False

            payload = {"email": username, "password": password}
            resp = self.session.post(login_url, data=payload, timeout=10,
                                     allow_redirects=True, verify=False)

            # Bloqueio após POST
            if "limite de tentativas" in resp.text.lower() or "excedeu" in resp.text.lower():
                self.login_error = "Conta bloqueada temporariamente — muitas tentativas de login. Tente após 1 hora."
                logger.error(f"SuperABC bloqueada: {self.login_error}")
                invalidate(CACHE_KEY)
                return False

            # Login falhou se continua na página de login
            if "/conta/acessar" in resp.url:
                self.login_error = "Login falhou — verifique as credenciais da Super ABC"
                logger.error(self.login_error)
                return False

            self.is_logged_in = True
            logger.info(f"Login OK → {resp.url}")
            return True

        except Exception as e:
            logger.error(f"Erro login SuperABC: {e}")
            return False

    def _fetch_page(self, query: str, page: int = 1) -> Optional[BeautifulSoup]:
        query_encoded = urllib.parse.quote(query)
        url = f"{self.base_url}/busca?q={query_encoded}"
        if page > 1:
            url += f"&page={page}"

        try:
            headers = {"Referer": self.base_url + "/"}
            resp = self.session.get(url, timeout=15, verify=False, headers=headers)
            logger.info(f"  GET {url} → {resp.status_code} | {len(resp.text)} chars")

            if resp.status_code != 200:
                return None

            # Detectar bloqueio na página de resultados
            if "limite de tentativas" in resp.text.lower():
                logger.error("SuperABC bloqueada durante busca")
                return None

            return BeautifulSoup(resp.text, "html.parser")

        except Exception as e:
            logger.error(f"Erro ao buscar página {page}: {e}")
            return None

    def _parse_products(self, soup: BeautifulSoup, page: int) -> List[dict]:
        products = []

        # Tentar vários seletores comuns de e-commerce
        cards = (
            soup.select(".product-layout")
            or soup.select(".product-thumb")
            or soup.select(".product-item")
            or soup.select("[class*='product-']")
            or soup.select(".item")
        )

        logger.info(f"  {len(cards)} cards na página {page}")

        if not cards:
            snippet = (soup.get_text(separator=" ", strip=True))[:300]
            logger.warning(f"  Sem cards. Texto: {snippet}")
            return []

        for card in cards:
            try:
                name_tag = (
                    card.select_one(".name a")
                    or card.select_one("h4 a")
                    or card.select_one("h3 a")
                    or card.select_one("a[title]")
                )
                if not name_tag:
                    continue

                product_name = name_tag.get_text(strip=True)
                if len(product_name) < 2:
                    continue

                product_url = name_tag.get("href", "")
                if product_url and not product_url.startswith("http"):
                    product_url = self.base_url + "/" + product_url.lstrip("/")

                sku = card.get("data-product-id") or card.get("data-id")
                if not sku and "product_id=" in product_url:
                    sku = product_url.split("product_id=")[-1].split("&")[0]

                img_tag = card.select_one("img")
                image_url = None
                if img_tag:
                    image_url = img_tag.get("data-src") or img_tag.get("src")

                price = 0.0
                for sel in [".price-new", ".price-normal", ".price", "[class*='price']"]:
                    el = card.select_one(sel)
                    if el:
                        price = self._extract_price(el.get_text(strip=True))
                        if price > 0:
                            break
                if price == 0:
                    for el in card.find_all(["span", "div", "strong"]):
                        txt = el.get_text(strip=True)
                        if "R$" in txt and len(txt) < 60:
                            price = self._extract_price(txt)
                            if price > 0:
                                break

                full_text = card.get_text().lower()
                availability = (
                    "indisponivel"
                    if any(w in full_text for w in ["indispon", "esgotado", "sem estoque"])
                    else "em_estoque"
                )

                products.append({
                    "product_name": product_name,
                    "product_url": product_url,
                    "image_url": image_url,
                    "price": price,
                    "availability": availability,
                    "sku": sku,
                })

            except Exception as e:
                logger.debug(f"Erro ao parsear card: {e}")

        logger.info(f"  {len(products)} produtos extraídos na página {page}")
        return products

    def _has_next_page(self, soup: BeautifulSoup) -> bool:
        pagination = soup.select_one("ul.pagination")
        if not pagination:
            return False
        active = pagination.select_one("li.active")
        if active and active.find_next_sibling("li"):
            link = active.find_next_sibling("li").find("a")
            return bool(link)
        return False

    def search(self, query: str, username: Optional[str] = None,
               password: Optional[str] = None, **_) -> List[ProductOffer]:
        offers = []
        try:
            logger.info(f"SuperABC | query: '{query}'")

            if username and password:
                cached = get_session(CACHE_KEY, username)
                if cached:
                    self.session = cached
                    self.is_logged_in = True
                    logger.info("  Reutilizando sessão cacheada")
                else:
                    if not self.login(username, password):
                        return []
                    store_session(CACHE_KEY, username, self.session)
            else:
                logger.info("  Sem credenciais — buscando como visitante")

            page = 1
            max_pages = 3
            total_products = []

            while page <= max_pages:
                soup = self._fetch_page(query, page)
                if not soup:
                    break

                products = self._parse_products(soup, page)
                if not products:
                    break

                total_products.extend(products)
                logger.info(f"  Página {page}: {len(products)} produtos | total: {len(total_products)}")

                if self._has_next_page(soup):
                    page += 1
                else:
                    break

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
            logger.info(f"SuperABC: {len(offers)} produtos retornados")

        except Exception as e:
            logger.error(f"Erro crítico SuperABC: {e}", exc_info=True)
            invalidate(CACHE_KEY)

        return offers
