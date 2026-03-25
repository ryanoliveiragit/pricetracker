from typing import List, Optional
import logging, re, urllib.parse
import requests
from bs4 import BeautifulSoup
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

logger = logging.getLogger(__name__)
BASE_URL = "https://www.cofema.com.br"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
MAX_PRODUCTS = 40
DETAIL_TIMEOUT = 10


class CofemaScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Cofema Materiais", base_url=BASE_URL, timeout=20)
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self._logged_in = False

    def login(self, username: str, password: str) -> bool:
        return self._do_login(username, password)

    def search(self, query: str, username: str = "", password: str = "", **kwargs) -> List[ProductOffer]:
        try:
            if username and password:
                self._do_login(username, password)
            return self._search(query)
        except Exception as e:
            logger.error(f"Cofema search error: {e}", exc_info=True)
            return []

    def _do_login(self, username: str, password: str) -> bool:
        try:
            r = self.session.get(f"{BASE_URL}/Home", timeout=15)
            r.raise_for_status()
            r2 = self.session.post(
                f"{BASE_URL}/Home/GetLogonPage",
                headers={**self.session.headers, "X-Requested-With": "XMLHttpRequest"},
                timeout=10,
            )
            token = ""
            if r2.ok:
                s = BeautifulSoup(r2.text, "html.parser")
                inp = s.find("input", {"name": "__RequestVerificationToken"})
                if inp:
                    token = inp.get("value", "")
            if not token:
                s = BeautifulSoup(r.text, "html.parser")
                inp = s.find("input", {"name": "__RequestVerificationToken"})
                if inp:
                    token = inp.get("value", "")
            logger.info("Cofema login token=%s", "ok" if token else "missing")
            r3 = self.session.post(
                f"{BASE_URL}/Home/Logon",
                data={"login": username, "senha": password, "__RequestVerificationToken": token},
                headers={**self.session.headers, "X-Requested-With": "XMLHttpRequest", "Referer": f"{BASE_URL}/Home"},
                timeout=15,
            )
            if r3.ok:
                try:
                    data = r3.json()
                    if data.get("success") or data.get("Success"):
                        self._logged_in = True
                        logger.info("Cofema login OK")
                        return True
                except Exception:
                    pass
                rc = self.session.get(f"{BASE_URL}/Home", timeout=10)
                if "/Home/Sair" in rc.text or "Clientes" in rc.text:
                    self._logged_in = True
                    logger.info("Cofema login OK (page check)")
                    return True
            logger.warning("Cofema login nao confirmado (%s)", r3.status_code)
            return False
        except Exception as e:
            logger.error("Cofema login error: %s", e)
            return False

    def _search(self, query: str) -> List[ProductOffer]:
        encoded = urllib.parse.quote(query)
        try:
            r = self.session.get(f"{BASE_URL}/Produto/Listar/Busca/?q={encoded}", timeout=15)
            r.raise_for_status()
        except Exception as e:
            logger.error("Cofema search page error: %s", e)
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        token = ""
        inp = soup.find("input", {"name": "__RequestVerificationToken"})
        if inp:
            token = inp.get("value", "")
        grid_html = self._fetch_grid(query, token)
        if not grid_html:
            logger.warning("Cofema: grid vazio")
            return []
        cards = self._parse_cards(grid_html)
        logger.info("Cofema: %d cards encontrados", len(cards))
        offers: List[ProductOffer] = []
        for i, card in enumerate(cards[:MAX_PRODUCTS]):
            offer = self._enrich_with_detail(card, i + 1)
            if offer and offer.price > 0:
                offers.append(offer)
        logger.info("Cofema: %d ofertas com preco", len(offers))
        return offers

    def _fetch_grid(self, query: str, token: str) -> str:
        try:
            r = self.session.post(
                f"{BASE_URL}/Item/GridItens",
                data={"filtro": query, "pagina": 1, "quantidade": MAX_PRODUCTS,
                      "ordenacao": "0", "__RequestVerificationToken": token},
                headers={**self.session.headers, "X-Requested-With": "XMLHttpRequest",
                          "Referer": f"{BASE_URL}/Produto/Listar/Busca/?q={urllib.parse.quote(query)}"},
                timeout=20,
            )
            if r.ok:
                return r.text
        except Exception as e:
            logger.error("Cofema GridItens error: %s", e)
        return ""

    def _parse_cards(self, html: str) -> List[dict]:
        soup = BeautifulSoup(html, "html.parser")
        cards = []
        items = soup.select("div.cat-prod.main-data-add")
        if not items:
            seen: set = set()
            for link in soup.select('a[href*="/Item/Detalhes/"]'):
                href = link.get("href", "")
                if href in seen:
                    continue
                seen.add(href)
                name = link.get_text(strip=True) or self._name_from_url(href)
                if href and len(name) >= 3:
                    cards.append({
                        "name": name,
                        "url": href if href.startswith("http") else f"{BASE_URL}{href}",
                        "sku": self._sku_from_url(href),
                        "image_url": None,
                    })
            return cards
        for item in items:
            try:
                link = item.select_one('a[href*="/Item/Detalhes/"], a.item-title')
                if not link:
                    continue
                href = link.get("href", "")
                name = link.get_text(strip=True) or self._name_from_url(href)
                if len(name) < 3:
                    continue
                url = href if href.startswith("http") else f"{BASE_URL}{href}"
                sku = None
                for sel in ["button[data-itemref]", "[data-itemref]"]:
                    el = item.select_one(sel)
                    if el:
                        sku = el.get("data-itemref") or self._sku_from_url(href)
                        break
                if not sku:
                    sku = self._sku_from_url(href)
                image_url = None
                img = item.select_one("img")
                if img:
                    src = img.get("src") or img.get("data-src", "")
                    if src and src.startswith("http"):
                        image_url = src
                cards.append({"name": name, "url": url, "sku": sku, "image_url": image_url})
            except Exception:
                continue
        return cards

    def _enrich_with_detail(self, card: dict, idx: int) -> Optional[ProductOffer]:
        try:
            r = self.session.get(card["url"], timeout=DETAIL_TIMEOUT)
            if not r.ok:
                return None
            soup = BeautifulSoup(r.text, "html.parser")
            price = self._extract_price(soup)
            image_url = card.get("image_url")
            if not image_url:
                for sel in ["img.w-100", 'img[src*="cdn"]', 'img[src*="produto"]', "img.img-fluid"]:
                    img = soup.select_one(sel)
                    if img:
                        src = img.get("src") or img.get("data-src", "")
                        if src and src.startswith("http"):
                            image_url = src
                            break
            name = card["name"]
            if len(name) < 3:
                h = soup.select_one("h1, h2, .product-title, .item-title")
                if h:
                    name = h.get_text(strip=True)
            logger.debug("  [%d] %s R$ %.2f", idx, name[:40], price)
            return ProductOffer(
                store=self.store_name,
                product_name=name,
                price=price,
                product_url=card["url"],
                add_to_cart_url=card["url"],
                availability="em_estoque" if price > 0 else "indisponivel",
                sku=card.get("sku"),
                image_url=image_url,
                description=None,
                brand=None,
            )
        except Exception as e:
            logger.debug("  [%d] detail error: %s", idx, e)
            return None

    def _extract_price(self, soup: BeautifulSoup) -> float:
        btn = soup.select_one("button[data-itempreco]")
        if btn:
            try:
                return float(str(btn.get("data-itempreco", "")).replace(",", "."))
            except ValueError:
                pass
        for inp in soup.select("input.radio-value[type=radio]"):
            try:
                p = float(str(inp.get("value", "")).replace(",", "."))
                if p > 0:
                    return p
            except ValueError:
                continue
        prices = []
        for m in re.findall(r"R\$\s*([\d.,]+)", soup.get_text()):
            try:
                p = float(m.replace(".", "").replace(",", "."))
                if 0.01 < p < 1_000_000:
                    prices.append(p)
            except ValueError:
                continue
        return min(prices) if prices else 0.0

    @staticmethod
    def _name_from_url(url: str) -> str:
        m = re.search(r"/Item/Detalhes/\d+[-/](.+?)(?:\?|$)", url)
        return m.group(1).replace("-", " ").title() if m else ""

    @staticmethod
    def _sku_from_url(url: str) -> Optional[str]:
        m = re.search(r"/Item/Detalhes/(\d+)", url)
        return m.group(1) if m else None
