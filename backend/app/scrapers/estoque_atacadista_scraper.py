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

DEFAULT_BASE_URL = "https://sjc.estoqueatacadista.com.br"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
}


class EstoqueAtacadistaScraper(BaseScraper):
    """
    Scraper para Estoque Atacadista (OpenCart).
    Usa requests + BeautifulSoup — sem Selenium.
    URL configurável via base_url (subdomínios: hnk, sjc, sp...).
    """

    def __init__(self):
        super().__init__(
            store_name="Estoque Atacadista",
            base_url=DEFAULT_BASE_URL,
            timeout=20,
        )
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.is_logged_in = False

    def login(self, username: str, password: str) -> bool:
        """Login no OpenCart — POST para /index.php?route=account/login."""
        try:
            login_url = f"{self.base_url}/index.php?route=account/login"
            logger.info(f"🔐 Login em {self.store_name} | URL: {login_url} | user: {username}")

            # GET para obter cookies iniciais e campos hidden (CSRF token)
            r = self.session.get(login_url, timeout=15, verify=False)
            logger.info(f"   GET login → status {r.status_code} | URL final: {r.url}")

            soup = BeautifulSoup(r.text, "html.parser")

            # Coletar campos hidden do formulário
            hidden_fields: dict = {}
            form = soup.find("form", {"action": lambda a: a and "login" in str(a)})
            if not form:
                form = soup.find("form")
            if form:
                for inp in form.find_all("input", type="hidden"):
                    name = inp.get("name")
                    if name:
                        hidden_fields[name] = inp.get("value", "")
                logger.info(f"   Campos hidden encontrados: {list(hidden_fields.keys())}")
            else:
                logger.warning("   ⚠️  Formulário de login não encontrado no HTML")

            payload = {**hidden_fields, "email": username, "password": password}

            resp = self.session.post(
                login_url,
                data=payload,
                timeout=15,
                allow_redirects=True,
                verify=False,
            )
            logger.info(f"   POST login → status {resp.status_code} | URL final: {resp.url}")

            if "route=account/login" in resp.url:
                logger.error(f"❌ Login falhou — ainda na página de login")
                return False

            self.is_logged_in = True
            logger.info(f"✅ Login bem-sucedido em {self.store_name}")
            return True

        except Exception as e:
            logger.error(f"❌ Erro no login de {self.store_name}: {e}", exc_info=True)
            return False

    def _fetch_page(self, query: str, page: int = 1) -> Optional[BeautifulSoup]:
        """Busca uma página de resultados OpenCart com &description=1."""
        query_encoded = urllib.parse.quote(query)
        url = (
            f"{self.base_url}/index.php?route=product/search"
            f"&search={query_encoded}&description=1&page={page}"
        )
        logger.info(f"   📥 GET página {page}: {url}")

        try:
            # Adicionar Referer para parecer navegação normal
            headers = {"Referer": self.base_url + "/"}
            resp = self.session.get(url, timeout=20, verify=False, headers=headers)
            logger.info(f"   → status {resp.status_code} | {len(resp.text)} chars")

            if resp.status_code == 403:
                logger.error(f"   ❌ 403 Forbidden — servidor bloqueando requisição")
                return None
            if resp.status_code != 200:
                logger.warning(f"   ⚠️  Status {resp.status_code} na página {page}")
                return None

            soup = BeautifulSoup(resp.text, "html.parser")

            title = soup.find("title")
            logger.info(f"   → título: {title.get_text(strip=True) if title else 'sem título'}")

            # Logar as primeiras classes encontradas para diagnóstico
            all_classes = set()
            for tag in soup.find_all(True):
                for cls in (tag.get("class") or []):
                    all_classes.add(cls)
                    if len(all_classes) > 40:
                        break
                if len(all_classes) > 40:
                    break
            logger.debug(f"   → classes no HTML: {sorted(all_classes)[:30]}")

            return soup

        except Exception as e:
            logger.error(f"   ❌ Erro ao buscar página {page}: {e}")
            return None

    def _parse_products(self, soup: BeautifulSoup, page: int) -> List[dict]:
        """Extrai produtos — seletores Journal3 (Estoque Atacadista)."""
        products = []

        # Journal3: produtos ficam em .post-layout dentro de .main-posts
        cards = soup.select(".main-posts .post-layout")
        if not cards:
            cards = soup.select(".post-layout")
        if not cards:
            cards = soup.select(".product-layout")
        if not cards:
            cards = soup.select(".product-thumb")

        logger.info(f"   🔍 {len(cards)} cards encontrados na página {page}")

        if not cards:
            # Log do HTML bruto para entender o que está chegando
            content = soup.select_one("#content") or soup.select_one("main") or soup.body
            if content:
                text_snippet = content.get_text(separator=" ", strip=True)[:500]
                logger.warning(f"   ⚠️  Sem cards. Texto da página: {text_snippet}")
            # Mostrar classes de divs filhos do body para diagnóstico
            if soup.body:
                top_classes = [
                    el.get("class", [])
                    for el in soup.body.find_all(True, recursive=False)
                ]
                logger.warning(f"   ⚠️  Classes top-level: {top_classes[:10]}")
            return []

        for idx, card in enumerate(cards, 1):
            try:
                # Journal3 usa .post-thumb .name a para o nome/link do produto
                name_tag = (
                    card.select_one(".post-thumb .name a")
                    or card.select_one(".name a")
                    or card.select_one(".caption h4 a")
                    or card.select_one("h4 a")
                    or card.select_one("a[href*='product_id']")
                )
                if not name_tag:
                    logger.debug(f"   [{idx}] Nome não encontrado — HTML: {str(card)[:300]}")
                    continue

                product_name = name_tag.get_text(strip=True)
                if len(product_name) < 2:
                    continue

                # URL do produto
                product_url = name_tag.get("href", "") if name_tag.name == "a" else ""
                if not product_url:
                    any_link = card.select_one("a[href*='product_id']") or card.select_one(".image a")
                    product_url = any_link.get("href", "") if any_link else ""
                if product_url and not product_url.startswith("http"):
                    product_url = self.base_url + "/" + product_url.lstrip("/")

                # SKU — preferência: data-product-id no card, fallback: product_id na URL
                sku = card.get("data-product-id")
                if not sku and "product_id=" in product_url:
                    sku = product_url.split("product_id=")[-1].split("&")[0]

                # Imagem — Journal3 usa lozad: imagem fica em data-src
                img_tag = card.select_one("img")
                image_url = None
                if img_tag:
                    image_url = (
                        img_tag.get("data-src")
                        or img_tag.get("src")
                        or img_tag.get("data-original")
                    )

                # Preço — Journal3 has-special: preço especial em .price-new
                # has-special coloca o preço original em .price-old e o especial em .price-new
                price = 0.0
                price_selectors = [
                    ".price-new",           # preço especial (has-special)
                    ".price-normal",        # preço normal
                    ".special-price",       # alternativa
                    ".product-price",       # outro padrão Journal3
                    ".price",               # genérico OpenCart
                    ".post-price",
                    "[class*='price-new']",
                    "[class*='price']",
                ]
                for sel in price_selectors:
                    price_tag = card.select_one(sel)
                    if price_tag:
                        price_text = price_tag.get_text(strip=True)
                        if price_text:
                            logger.debug(f"   [{idx}] Preço ({sel}): {price_text!r}")
                            price = self._extract_price(price_text)
                            if price > 0:
                                break

                if price == 0:
                    # Fallback: qualquer texto com R$ no card (limite mais generoso)
                    for el in card.find_all(["span", "p", "div", "strong"]):
                        text = el.get_text(strip=True)
                        if "R$" in text and len(text) < 60:
                            price = self._extract_price(text)
                            if price > 0:
                                logger.debug(f"   [{idx}] Preço fallback: {text!r} → {price}")
                                break

                if price == 0 and idx == 1:
                    # Log completo para diagnóstico — apenas para o 1º card sem preço
                    price_els = card.find_all(class_=lambda c: c and "price" in " ".join(c).lower())
                    logger.warning(f"   ⚠️  Preço não encontrado no 1º card.")
                    logger.warning(f"   Elementos com 'price' na classe: {[(str(el)[:200]) for el in price_els]}")
                    logger.warning(f"   HTML COMPLETO DO CARD:\n{str(card)}")

                # Disponibilidade
                full_text = card.get_text().lower()
                availability = (
                    "indisponivel"
                    if any(w in full_text for w in ["indispon", "esgotado", "sem estoque"])
                    else "em_estoque"
                )

                logger.debug(f"   [{idx}] ✓ {product_name[:50]} | R${price:.2f} | SKU:{sku}")
                products.append({
                    "product_name": product_name,
                    "product_url": product_url,
                    "image_url": image_url,
                    "price": price,
                    "availability": availability,
                    "sku": sku,
                })

            except Exception as e:
                logger.debug(f"   [{idx}] Erro: {e}")
                continue

        logger.info(f"   📦 {len(products)} produtos extraídos na página {page}")
        return products

    def _has_next_page(self, soup: BeautifulSoup) -> bool:
        """Verifica próxima página na paginação OpenCart padrão."""
        pagination = soup.select_one("ul.pagination")
        if not pagination:
            return False

        # Encontrar item ativo e ver se há próximo
        active = pagination.select_one("li.active")
        if active and active.find_next_sibling("li"):
            sibling = active.find_next_sibling("li")
            # Não contar o botão ">" final como próxima página válida
            link = sibling.find("a")
            if link:
                text = link.get_text(strip=True)
                if text not in [">", "»", "›"]:
                    return True
                # Se é o botão ">", há próxima página
                return True

        return False

    def search(self, query: str, username: Optional[str] = None, password: Optional[str] = None, region: str = "sp") -> List[ProductOffer]:
        """Busca todos os produtos no Estoque Atacadista."""
        CACHE_KEY = "estoqueatacadista"
        offers = []
        try:
            logger.info(f"🔍 {self.store_name} | base_url: {self.base_url} | query: '{query}'")

            if username and password:
                cached = get_session(CACHE_KEY, username)
                if cached:
                    self.session = cached
                    self.is_logged_in = True
                    logger.info("   ✅ Reutilizando sessão cacheada")
                else:
                    login_ok = self.login(username, password)
                    if not login_ok:
                        logger.warning("⚠️  Login falhou — buscando como visitante")
                    else:
                        store_session(CACHE_KEY, username, self.session)
            else:
                logger.info("ℹ️  Sem credenciais — buscando como visitante")

            page = 1
            max_pages = 5
            total_products = []

            while page <= max_pages:
                soup = self._fetch_page(query, page)
                if not soup:
                    logger.error(f"   ❌ Falha ao buscar página {page} — abortando")
                    break

                products = self._parse_products(soup, page)
                if not products:
                    logger.info(f"   ℹ️  Página {page} vazia — fim da busca")
                    break

                total_products.extend(products)
                logger.info(f"   ✅ Página {page}: {len(products)} produtos | acumulado: {len(total_products)}")

                if self._has_next_page(soup):
                    page += 1
                else:
                    logger.info(f"   ✅ Última página: {page}")
                    break

            logger.info(f"📊 Total bruto: {len(total_products)} produtos em {self.store_name}")

            # Deduplicar e converter
            seen = set()
            for p in total_products:
                key = p["sku"] or p["product_url"]
                if key in seen:
                    continue
                seen.add(key)
                offers.append(ProductOffer(
                    store=self.store_name,
                    product_name=p["product_name"],
                    price=p["price"],
                    currency="BRL",
                    product_url=p["product_url"],
                    add_to_cart_url=p["product_url"],
                    availability=p["availability"],
                    sku=p["sku"],
                    image_url=p["image_url"],
                ))

            offers = self._rank_results(query, offers, limit=None)
            logger.info(f"✅ {self.store_name}: {len(offers)} produtos retornados")

        except Exception as e:
            logger.error(f"❌ Erro crítico em {self.store_name}: {e}", exc_info=True)
            invalidate(CACHE_KEY)

        return offers
