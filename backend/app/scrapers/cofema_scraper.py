from typing import List, Optional
import logging, re, urllib.parse
import requests
from bs4 import BeautifulSoup
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

logger = logging.getLogger(__name__)
BASE_URL = "https://www.cofema.com.br"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
MAX_PRODUCTS = 40


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
            # GET homepage para obter cookies (token vem do cookie, não do HTML)
            r = self.session.get(f"{BASE_URL}/Home", timeout=15)
            r.raise_for_status()
            token = self.session.cookies.get("__RequestVerificationToken", "")

            # Simula abertura do modal de login
            self.session.post(
                f"{BASE_URL}/Home/GetLogonPage",
                headers={**self.session.headers, "X-Requested-With": "XMLHttpRequest", "Referer": f"{BASE_URL}/Home"},
                timeout=10,
            )

            logger.info("Cofema login token=%s", "ok" if token else "missing")

            # Campos corretos: User, Password, RememberMe, ReturnUrl
            r3 = self.session.post(
                f"{BASE_URL}/Home/Logon",
                data={
                    "User": username,
                    "Password": password,
                    "RememberMe": "true",
                    "ReturnUrl": "",
                    "__RequestVerificationToken": token,
                },
                headers={
                    **self.session.headers,
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": f"{BASE_URL}/Home",
                    "Origin": BASE_URL,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                },
                timeout=15,
            )
            if r3.ok:
                try:
                    data = r3.json()
                    if data.get("success") or data.get("Success"):
                        self._logged_in = True
                        logger.info("Cofema login OK")
                        return True
                    logger.warning("Cofema login falhou: %s", data.get("message", ""))
                except Exception:
                    pass
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
        inp = soup.find("input", {"name": "__RequestVerificationToken"})
        page_token = inp.get("value", "") if inp else self.session.cookies.get("__RequestVerificationToken", "")

        # Extrair data-attrs do elemento grid para montar o POST correto
        grid_el = soup.find(attrs={"data-grid": True})
        grid_data = {}
        if grid_el:
            for attr, val in grid_el.attrs.items():
                if attr.startswith("data-"):
                    key = attr[5:]  # remove "data-"
                    grid_data[key] = val

        html = self._fetch_grid(query, page_token, grid_data)
        if not html:
            logger.warning("Cofema: grid vazio")
            return []

        offers = self._parse_grid_html(html)
        logger.info("Cofema: %d ofertas", len(offers))
        return offers

    def _fetch_grid(self, query: str, token: str, grid_data: dict) -> str:
        encoded = urllib.parse.quote(query)
        try:
            payload = {
                "getPage": "1",
                "rows": grid_data.get("rows", "24"),
                "grid": grid_data.get("grid", "GridItens"),
                "header": grid_data.get("header", "false"),
                "showInfo": grid_data.get("showinfo", "true"),
                "paramFilter": query,
                "layout": grid_data.get("layout", "VitrineProdutos"),
                "id": grid_data.get("id", "0"),
                "order": grid_data.get("order", ""),
                "parentId": grid_data.get("param-parentid", "0"),
                "filtercolumn": grid_data.get("filtercolumn", "busca"),
                "filter": query,
                "paramParentid": grid_data.get("param-parentid", "0"),
                "paramMarcaid": grid_data.get("param-marcaid", "0"),
                "paramIsrelampago": grid_data.get("param-isrelampago", ""),
                "paramTabela": grid_data.get("param-tabela", ""),
                "__RequestVerificationToken": token,
            }
            r = self.session.post(
                f"{BASE_URL}/Item/GridItens",
                data=payload,
                headers={
                    **self.session.headers,
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": f"{BASE_URL}/Produto/Listar/Busca/?q={encoded}",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
                timeout=20,
            )
            if r.ok:
                try:
                    return r.json().get("data", "")
                except Exception:
                    return r.text
        except Exception as e:
            logger.error("Cofema GridItens error: %s", e)
        return ""

    def _parse_grid_html(self, html: str) -> List[ProductOffer]:
        soup = BeautifulSoup(html, "html.parser")
        offers: List[ProductOffer] = []
        seen: set = set()

        cards = soup.select("div.main-data-add")
        if not cards:
            # fallback: links diretos
            cards_data = []
            for link in soup.select('a[href*="/Item/Detalhes/"]'):
                href = link.get("href", "")
                if not href or href in seen:
                    continue
                seen.add(href)
                name = link.get_text(strip=True)
                if len(name) >= 3:
                    cards_data.append({"name": name, "url": f"{BASE_URL}{href}", "sku": self._sku_from_url(href), "price": 0.0, "image_url": None})
            for c in cards_data[:MAX_PRODUCTS]:
                offers.append(ProductOffer(
                    store=self.store_name, product_name=c["name"], price=c["price"],
                    product_url=c["url"], add_to_cart_url=c["url"],
                    availability="em_estoque", sku=c["sku"], image_url=None,
                ))
            return offers

        for card in cards[:MAX_PRODUCTS]:
            try:
                name_tag = card.select_one("a.item-title")
                if not name_tag:
                    continue
                name = name_tag.get_text(strip=True)
                if len(name) < 3:
                    continue
                href = name_tag.get("href", "")
                url = href if href.startswith("http") else f"{BASE_URL}{href}"
                sku = name_tag.get("data-itemid") or self._sku_from_url(href)

                if url in seen:
                    continue
                seen.add(url)

                # Imagem
                img = card.select_one("img.item-photo")
                image_url = img.get("src") if img else None

                # Preço: radio inputs têm valor em format "317.900" = R$ 317,90
                price = 0.0
                for radio in card.select("input[type=radio][value]"):
                    try:
                        p = float(radio.get("value", "0"))
                        if p > 0:
                            price = p
                            break
                    except ValueError:
                        continue

                # Fallback: data-itempreco no botão
                if price == 0:
                    btn = card.select_one("button[data-itempreco]")
                    if btn:
                        try:
                            price = float(btn.get("data-itempreco", "0"))
                        except ValueError:
                            pass

                logger.debug("  %s R$ %.2f", name[:40], price)
                offers.append(ProductOffer(
                    store=self.store_name,
                    product_name=name,
                    price=price,
                    product_url=url,
                    add_to_cart_url=url,
                    availability="em_estoque" if price > 0 else "indisponivel",
                    sku=sku,
                    image_url=image_url,
                    description=None,
                    brand=None,
                ))
            except Exception as e:
                logger.debug("Card error: %s", e)
                continue

        return offers

    @staticmethod
    def _sku_from_url(url: str) -> Optional[str]:
        m = re.search(r"/Item/Detalhes/(\d+)", url)
        return m.group(1) if m else None
