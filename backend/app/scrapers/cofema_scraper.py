from typing import List, Optional
import logging, re, urllib.parse, json, time
import requests
from bs4 import BeautifulSoup
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer
from app.services.session_cache import get_session, store_session, invalidate, get_login_lock

logger = logging.getLogger(__name__)
BASE_URL = "https://www.cofema.com.br"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Cache-Control": "max-age=0",
}
MAX_PRODUCTS = 40
MAX_LOGIN_RETRIES = 3
CACHE_KEY = "cofema"


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
                cached = get_session(CACHE_KEY, username)
                if cached:
                    self.session = cached
                    self._logged_in = True
                else:
                    # Lock evita que múltiplas buscas simultâneas façam login ao mesmo tempo (429)
                    with get_login_lock(CACHE_KEY):
                        # Re-check após adquirir o lock (outro thread pode ter logado)
                        cached = get_session(CACHE_KEY, username)
                        if cached:
                            self.session = cached
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
            logger.error(f"Cofema search error: {e}", exc_info=True)
            invalidate(CACHE_KEY)
            return []

    def _do_login(self, username: str, password: str) -> bool:
        try:
            r = self.session.get(f"{BASE_URL}/Home", timeout=15)
            if r.status_code == 429:
                logger.warning("Cofema: IP bloqueado pelo CDN (429) — pulando Cofema nesta busca")
                return False
            r.raise_for_status()

            token = self.session.cookies.get("__RequestVerificationToken", "")
            if not token:
                from bs4 import BeautifulSoup as _BS
                inp = _BS(r.text, "html.parser").find("input", {"name": "__RequestVerificationToken"})
                token = inp.get("value", "") if inp else ""

            if not token:
                logger.warning("Cofema: token CSRF não encontrado — pulando login")
                return False

            time.sleep(1)

            r3 = self.session.post(
                f"{BASE_URL}/Home/Logon",
                data={"User": username, "Password": password, "RememberMe": "true", "ReturnUrl": "", "__RequestVerificationToken": token},
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

            if r3.status_code == 429:
                logger.warning("Cofema: IP bloqueado no Logon (429) — pulando Cofema. O CDN bloqueou o IP do servidor.")
                return False

            if not r3.ok:
                logger.warning("Cofema: login retornou HTTP %d", r3.status_code)
                return False

            try:
                data = r3.json()
                if data.get("success") or data.get("Success"):
                    self._logged_in = True
                    logger.info("Cofema: login OK")
                    return True
                logger.warning("Cofema: login falhou — resposta: %s", data.get("message", r3.text[:100]))
            except Exception:
                logger.warning("Cofema: resposta não é JSON — %s", r3.text[:100])

        except Exception as e:
            logger.error("Cofema login error: %s", e)

        return False

    def _search(self, query: str) -> List[ProductOffer]:
        encoded = urllib.parse.quote(query)
        try:
            time.sleep(1)
            r = self.session.get(f"{BASE_URL}/Produto/Listar/Busca/?q={encoded}", timeout=15)
            r.raise_for_status()
        except Exception as e:
            logger.error("Cofema search page error: %s", e)
            return []

        soup = BeautifulSoup(r.text, "html.parser")
        inp = soup.find("input", {"name": "__RequestVerificationToken"})
        page_token = inp.get("value", "") if inp else self.session.cookies.get("__RequestVerificationToken", "")

        grid_el = soup.find(attrs={"data-grid": True})
        gd = {k[5:]: v for k, v in grid_el.attrs.items() if k.startswith("data-")} if grid_el else {}

        time.sleep(1)
        html = self._fetch_grid(query, page_token, gd)
        if not html:
            logger.warning("Cofema: grid vazio")
            return []

        offers, missing_price_ids = self._parse_grid_html(html)

        if not offers:
            logger.info("Cofema: nenhum produto encontrado para '%s'", query)
            return []

        # Buscar preços via GetStock para produtos sem preço
        if missing_price_ids and self._logged_in:
            logger.info("Cofema: buscando preços via GetStock para %d produtos", len(missing_price_ids))
            time.sleep(1)
            prices = self._fetch_stock_prices(list(missing_price_ids.keys()), page_token)
            for offer in offers:
                if offer.price == 0 and offer.sku in prices:
                    offer.price = prices[offer.sku]
                    offer.availability = "em_estoque" if offer.price > 0 else "indisponivel"

        # Fallback: buscar preço na página de detalhe para os que ainda estão sem preço
        still_missing = [o for o in offers if o.price == 0]
        if still_missing:
            logger.info("Cofema: buscando preço na página de detalhe para %d produtos", len(still_missing))
            for offer in still_missing[:10]:  # limita para não demorar demais
                try:
                    time.sleep(0.5)
                    rd = self.session.get(offer.product_url, timeout=10)
                    if rd.ok:
                        price = self._extract_price_from_detail(rd.text)
                        if price > 0:
                            offer.price = price
                            offer.availability = "em_estoque"
                except Exception:
                    pass

        logger.info("Cofema: %d produtos encontrados (%d com preço)",
                    len(offers), sum(1 for o in offers if o.price > 0))
        return offers

    def _fetch_grid(self, query: str, token: str, gd: dict) -> str:
        encoded = urllib.parse.quote(query)
        try:
            r = self.session.post(
                f"{BASE_URL}/Item/GridItens",
                data={
                    "getPage": "1",
                    "rows": gd.get("rows", "24"),
                    "grid": gd.get("grid", "GridItens"),
                    "header": gd.get("header", "false"),
                    "showInfo": gd.get("showinfo", "true"),
                    "paramFilter": query,
                    "layout": gd.get("layout", "VitrineProdutos"),
                    "id": gd.get("id", "0"),
                    "order": gd.get("order", ""),
                    "parentId": gd.get("param-parentid", "0"),
                    "filtercolumn": gd.get("filtercolumn", "busca"),
                    "filter": query,
                    "paramParentid": gd.get("param-parentid", "0"),
                    "paramMarcaid": gd.get("param-marcaid", "0"),
                    "paramIsrelampago": gd.get("param-isrelampago", ""),
                    "paramTabela": gd.get("param-tabela", ""),
                    "__RequestVerificationToken": token,
                },
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

    def _fetch_stock_prices(self, item_ids: List[str], token: str) -> dict:
        """Busca preços via /Item/GetStock. Retorna dict {sku: price}."""
        try:
            r = self.session.post(
                f"{BASE_URL}/Item/GetStock",
                data={"list": json.dumps([int(i) for i in item_ids]), "__RequestVerificationToken": token},
                headers={
                    **self.session.headers,
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": f"{BASE_URL}/Produto/Listar/Busca/",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
                timeout=20,
            )
            if not r.ok or not r.text:
                return {}
            data = r.json()
            if not data.get("success"):
                logger.warning("Cofema GetStock falhou: %s", data.get("message", ""))
                return {}

            soup = BeautifulSoup(data.get("data", ""), "html.parser")
            prices = {}
            for item_el in soup.select("[data-item]"):
                sku = item_el.get("data-item")
                if not sku:
                    continue
                # Preço em radio inputs: valor como "317.900" = R$317,90
                for radio in item_el.select("input[type=radio][value]"):
                    try:
                        p = float(radio.get("value", "0"))
                        if p > 0:
                            prices[sku] = p
                            break
                    except ValueError:
                        continue
                # Fallback: data-itempreco no botão
                if sku not in prices:
                    btn = item_el.select_one("button[data-itempreco]")
                    if btn:
                        try:
                            p = float(btn.get("data-itempreco", "0"))
                            if p > 0:
                                prices[sku] = p
                        except ValueError:
                            pass
            logger.info("Cofema GetStock: %d preços recebidos", len(prices))
            return prices
        except Exception as e:
            logger.error("Cofema GetStock error: %s", e)
            return {}

    def _parse_grid_html(self, html: str):
        """Retorna (offers, missing_price_ids) onde missing é {sku: True} para offers sem preço."""
        soup = BeautifulSoup(html, "html.parser")
        offers: List[ProductOffer] = []
        missing: dict = {}
        seen: set = set()

        cards = soup.select("div.main-data-add")
        if not cards:
            return offers, missing

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

                img = card.select_one("img.item-photo")
                image_url = img.get("src") if img else None

                # Preço: radio inputs têm valor "317.900" = R$317,90
                price = 0.0
                for radio in card.select("input[type=radio][value]"):
                    try:
                        p = float(radio.get("value", "0"))
                        if p > 0:
                            price = p
                            break
                    except ValueError:
                        continue

                if price == 0:
                    btn = card.select_one("button[data-itempreco]")
                    if btn:
                        try:
                            price = float(btn.get("data-itempreco", "0"))
                        except ValueError:
                            pass

                offer = ProductOffer(
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
                )
                offers.append(offer)

                if price == 0 and sku:
                    missing[sku] = True

            except Exception as e:
                logger.debug("Card error: %s", e)
                continue

        return offers, missing

    @staticmethod
    def _extract_price_from_detail(html: str) -> float:
        soup = BeautifulSoup(html, "html.parser")
        # Radio inputs na página de detalhe
        for radio in soup.select("input[type=radio].radio-value[value], .box-values input[type=radio][value]"):
            try:
                p = float(radio.get("value", "0"))
                if p > 0:
                    return p
            except ValueError:
                continue
        # data-itempreco em botão
        btn = soup.select_one("button[data-itempreco]")
        if btn:
            try:
                p = float(btn.get("data-itempreco", "0"))
                if p > 0:
                    return p
            except ValueError:
                pass
        # Regex em texto da página
        prices = []
        for m in re.findall(r"R\$\s*([\d.]+,\d{2})", soup.get_text()):
            try:
                p = float(m.replace(".", "").replace(",", "."))
                if 0.01 < p < 1_000_000:
                    prices.append(p)
            except ValueError:
                continue
        return min(prices) if prices else 0.0

    @staticmethod
    def _sku_from_url(url: str) -> Optional[str]:
        m = re.search(r"/Item/Detalhes/(\d+)", url)
        return m.group(1) if m else None
