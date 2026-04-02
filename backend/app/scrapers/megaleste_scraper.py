from typing import List, Optional
import requests
from bs4 import BeautifulSoup
import time
import logging
import re
import urllib.parse
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer
from app.services.session_cache import get_session, store_session, invalidate

logger = logging.getLogger(__name__)

BASE_URL = "https://www.megaleste.com.br"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


class MegalesteScraper(BaseScraper):
    """
    Scraper para Estoque Megaleste usando requests + BeautifulSoup.
    Selenium é usado APENAS para login (obter cookies de sessão).
    Todo o scraping é feito via requests — sem stale elements, sem timing issues.
    """

    def __init__(self):
        super().__init__(
            store_name="Estoque Megaleste",
            base_url=BASE_URL,
            timeout=20
        )
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.is_logged_in = False

    def login(self, username: str, password: str, region: str = "sp") -> bool:
        """
        Faz login usando requests.Session — mais rápido e confiável que Selenium.
        """
        try:
            region = (region or "sp").lower().strip()
            logger.info(f"🔐 Iniciando login em {self.store_name} com usuário: {username} (região: {region})")

            # 1. Primeiro, acessar a home para obter cookies iniciais
            self.session.get(f"{BASE_URL}/{region}", timeout=15)

            # 2. Fazer POST de login
            login_data = {
                "state": region,
                "user": username,
                "pass": password,
            }
            resp = self.session.post(
                f"{BASE_URL}/login/auth",
                data=login_data,
                timeout=15,
                allow_redirects=True,
            )

            # 3. Verificar se login foi bem-sucedido
            # Após login, o site redireciona para /c/ (área do cliente)
            if "/c" in resp.url or resp.url.endswith(BASE_URL + "/") or "logout" in resp.text:
                self.is_logged_in = True
                logger.info(f"✅ Login bem-sucedido via requests — URL final: {resp.url}")
                return True

            # Verificar se está na área do cliente pela presença de elementos típicos
            soup = BeautifulSoup(resp.text, "html.parser")
            logout_link = soup.find("a", href=lambda h: h and "logout" in h)
            user_menu = soup.find("strong", string=lambda s: s and s.strip())

            if logout_link or user_menu:
                self.is_logged_in = True
                logger.info(f"✅ Login confirmado pela presença de elementos da sessão")
                return True

            # Verificar mensagem de erro
            error_text = soup.get_text()
            if "incorreta" in error_text.lower() or "inválid" in error_text.lower():
                logger.error(f"❌ Credenciais inválidas para {self.store_name}")
                return False

            # Se chegou até aqui, assumir login OK (site pode redirecionar de formas variadas)
            self.is_logged_in = True
            logger.info(f"✅ Login assumido como bem-sucedido (URL: {resp.url})")
            return True

        except Exception as e:
            logger.error(f"❌ Erro no login via requests: {e}")
            # Fallback: tentar login com Selenium
            return self._login_selenium(username, password)

    def _login_selenium(self, username: str, password: str) -> bool:
        """Fallback: login via Selenium, depois transfere cookies para a session requests."""
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.common.exceptions import NoSuchElementException

            logger.info("🔄 Usando Selenium como fallback para login...")
            self.driver = self._init_driver(headless=True)
            self.driver.get(BASE_URL)

            # Abrir menu de login
            user_menu_btn = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "a[role='button']"))
            )
            user_menu_btn.click()
            time.sleep(1)

            # Preencher credenciais
            email_input = WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder='login']"))
            )
            pass_input = self.driver.find_element(By.CSS_SELECTOR, "input[placeholder='senha']")
            email_input.send_keys(username)
            pass_input.send_keys(password)

            # Submeter
            try:
                btn = self.driver.find_element(By.XPATH, "//button[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'entrar')]")
                btn.click()
            except NoSuchElementException:
                from selenium.webdriver.common.keys import Keys
                pass_input.send_keys(Keys.RETURN)

            time.sleep(4)

            # Transferir cookies do Selenium para a session requests
            for cookie in self.driver.get_cookies():
                self.session.cookies.set(cookie['name'], cookie['value'])

            self.is_logged_in = True
            logger.info("✅ Login Selenium OK — cookies transferidos para requests")
            return True

        except Exception as e:
            logger.error(f"❌ Erro no login Selenium fallback: {e}")
            return False
        finally:
            self._close_driver()

    def _fetch_page(self, query: str, page: int = 1) -> Optional[BeautifulSoup]:
        """Busca uma página de resultados usando requests."""
        query_encoded = urllib.parse.quote(query)
        url = f"{BASE_URL}/c/busca?linha=&q={query_encoded}&page={page}"
        logger.info(f"   📥 Buscando página {page}: {url}")

        try:
            resp = self.session.get(url, timeout=20)
            if resp.status_code != 200:
                logger.warning(f"   ⚠️  Status {resp.status_code} na página {page}")
                return None
            return BeautifulSoup(resp.text, "html.parser")
        except Exception as e:
            logger.error(f"   ❌ Erro ao buscar página {page}: {e}")
            return None

    def _parse_products(self, soup: BeautifulSoup, page: int) -> List[dict]:
        """Extrai todos os produtos de uma BeautifulSoup."""
        products = []

        product_divs = soup.select(".search-result .product-line")
        if not product_divs:
            product_divs = soup.select(".product-line[data-id]")
        if not product_divs:
            product_divs = soup.select(".product-line")

        logger.info(f"   📦 {len(product_divs)} produtos encontrados na página {page}")

        for div in product_divs:
            try:
                # ID / SKU
                product_id = div.get("data-id", "")

                # Nome
                name_tag = div.select_one(".product-content h4")
                product_name = name_tag.get_text(strip=True) if name_tag else ""
                if not product_name:
                    link_tag = div.select_one("a.btn-modal")
                    product_name = link_tag.get("title", "") if link_tag else ""
                if not product_name or len(product_name) < 2:
                    continue

                # Descrição (nome + código + embalagem)
                small_tag = div.select_one(".product-content small")
                small_text = small_tag.get_text(strip=True) if small_tag else ""
                description = f"{product_name} - {small_text}" if small_text else product_name

                # SKU do texto "Cód. XXXXX"
                sku = product_id
                if not sku and small_text:
                    m = re.search(r'Cód\.\s*(\d+)', small_text)
                    if m:
                        sku = m.group(1)

                # URL do produto — /c/produto/{id} é endpoint AJAX de modal (retorna JSON),
                # não é uma página navegável. Usar busca com o nome como URL de referência.
                if product_name:
                    product_url = f"{BASE_URL}/c/busca?q={urllib.parse.quote(product_name)}"
                elif product_id:
                    product_url = f"{BASE_URL}/c/busca?q={product_id}"
                else:
                    product_url = BASE_URL

                # Imagem
                img_tag = div.select_one("img")
                image_url = None
                if img_tag:
                    image_url = img_tag.get("src") or img_tag.get("data-src")

                # Preço — COM desconto (span.text-danger dentro de div.price)
                price = 0.0
                price_text = ""
                price_discount = div.select_one("div.price span.text-danger")
                if price_discount:
                    price_text = price_discount.get_text(strip=True)
                else:
                    price_normal = div.select_one("span.price")
                    if price_normal:
                        t = price_normal.get_text(strip=True)
                        if "INDISPON" not in t.upper():
                            price_text = t

                if price_text and "R$" in price_text:
                    price = self._extract_price(price_text)

                # Disponibilidade
                full_text = div.get_text().lower()
                availability = "indisponivel" if any(w in full_text for w in ["indispon", "esgotado", "sem estoque"]) else "em_estoque"

                products.append({
                    "product_name": product_name,
                    "description": description,
                    "sku": sku,
                    "product_url": product_url,
                    "image_url": image_url,
                    "price": price,
                    "availability": availability,
                })

            except Exception as e:
                logger.debug(f"   Erro ao parsear produto: {e}")
                continue

        return products

    def _has_next_page(self, soup: BeautifulSoup) -> Optional[str]:
        """Retorna a URL da próxima página ou None se não houver."""
        next_link = soup.select_one("li.page-item.next a[rel='next']")
        if next_link and next_link.get("href"):
            url = next_link["href"].replace(":443", "")
            if not url.startswith("http"):
                url = BASE_URL + url
            return url
        return None

    def search(self, query: str, username: str = None, password: str = None, region: str = "sp") -> List[ProductOffer]:
        """
        Busca todos os produtos em TODAS as páginas e retorna a lista completa.
        Usa requests + BeautifulSoup — rápido e sem stale elements.
        """
        CACHE_KEY = f"megaleste_{region}"
        offers = []
        try:
            logger.info(f"🔍 Iniciando scraping em {self.store_name} para: '{query}'")

            if not username or not password:
                logger.error(f"❌ {self.store_name} REQUER credenciais! Configure no .env")
                return []

            # Reutilizar sessão cacheada se disponível
            cached = get_session(CACHE_KEY, username)
            if cached:
                self.session = cached
                self.is_logged_in = True
            else:
                if not self.login(username, password, region):
                    logger.error("❌ Login falhou!")
                    return []
                store_session(CACHE_KEY, username, self.session)

            # Iterar pelas primeiras páginas (resultados mais relevantes aparecem primeiro)
            page = 1
            max_pages = 5
            total_products = []

            while page <= max_pages:
                soup = self._fetch_page(query, page)
                if not soup:
                    logger.info(f"   ⚠️  Não foi possível obter página {page}")
                    break

                products = self._parse_products(soup, page)
                if not products:
                    logger.info(f"   ℹ️  Página {page} sem produtos — fim da busca")
                    break

                total_products.extend(products)
                logger.info(f"   ✅ Página {page}: {len(products)} produtos (total acumulado: {len(total_products)})")

                # Verificar próxima página
                next_url = self._has_next_page(soup)
                if next_url:
                    logger.info(f"   ➡️  Próxima página disponível")
                    page += 1
                    time.sleep(0.1)  # Delay mínimo entre páginas
                else:
                    logger.info(f"   ✅ Última página alcançada ({page} página(s) no total)")
                    break

            logger.info(f"📊 Total bruto: {len(total_products)} produtos encontrados")

            # Converter para ProductOffer (deduplica por SKU)
            seen_skus = set()
            for p in total_products:
                sku_key = p["sku"] or p["product_url"]
                if sku_key in seen_skus:
                    continue
                seen_skus.add(sku_key)

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
                    description=p["description"],
                ))

            # Ranquear por similaridade (sem limite — retorna TODOS)
            offers = self._rank_results(query, offers, limit=None)
            logger.info(f"✅ {self.store_name}: {len(offers)} produtos retornados")

        except Exception as e:
            logger.error(f"❌ Erro crítico em {self.store_name}: {e}", exc_info=True)
            invalidate(CACHE_KEY)
        finally:
            self._close_driver()

        return offers
