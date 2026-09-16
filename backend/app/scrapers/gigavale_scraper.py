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
import time
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


def _manual_session_only() -> bool:
    """Quando ativo, a Gigavale só usa cookies semeados manualmente
    (seed_gigavale_session.py) e NUNCA tenta o login por Selenium — que não
    passa no reCAPTCHA v2 invisível. Ativar com GIGAVALE_MANUAL_SESSION_ONLY=1."""
    return os.getenv("GIGAVALE_MANUAL_SESSION_ONLY", "").strip().lower() in ("1", "true", "yes", "on")


class GigavaleScraper(BaseScraper):
    """Busca produtos e preços autenticados na Gigavale Atacado."""

    # Tentativas de login: o reCAPTCHA headless às vezes exibe um desafio e
    # trava o envio; um navegador novo a cada tentativa costuma passar em uma
    # delas. Mantido baixo para caber no timeout do gerenciador.
    _MAX_LOGIN_ATTEMPTS = 4

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
        """Detect the logged-in marker emitted by the Gigavale layout.

        The Agile B2B layout exposes ``var ID_CLIENTE = null`` while anonymous
        and a numeric client id once the session is authenticated. This is the
        canonical signal and works on ``/``, ``/entrar`` and ``/busca`` alike.
        The old ``"perfil":"cliente"`` heuristic was too strict — the profile
        field does not always carry the literal value ``cliente``, which made
        the scraper reject a session that had actually logged in.
        """
        id_cliente = re.search(r'var\s+ID_CLIENTE\s*=\s*([^;]+);', html)
        if id_cliente:
            value = id_cliente.group(1).strip().strip("\"'").lower()
            return value not in ("", "null", "undefined", "0", "false", "none")

        # Fallback for any layout variation that omits the ID_CLIENTE marker.
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

        # O campo de senha da Gigavale tem minlength=8/maxlength=12; o navegador
        # trunca silenciosamente valores maiores, o que faria o login falhar sem
        # explicação. Validamos antes para dar um erro claro.
        if not 8 <= len(password) <= 12:
            self.login_error = (
                "A senha da Gigavale precisa ter entre 8 e 12 caracteres "
                "(limite imposto pelo formulário da loja)"
            )
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
        # Reduz as pistas de automação que fazem o reCAPTCHA disparar o desafio.
        try:
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)
        except Exception:
            logger.debug("Gigavale: experimental options indisponíveis", exc_info=True)
        # O reCAPTCHA passa muito mais confiável em navegador VISÍVEL (headful).
        # Quando há um display (máquina de desenvolvimento), rodamos visível;
        # em produção (container sem DISPLAY) caímos para headless. Dá para
        # forçar headless com GIGAVALE_FORCE_HEADLESS=1.
        force_headless = os.getenv("GIGAVALE_FORCE_HEADLESS", "").lower() in ("1", "true", "yes")
        has_display = bool(os.getenv("DISPLAY") or os.getenv("WAYLAND_DISPLAY"))
        use_headless = force_headless or not has_display
        arguments = [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--disable-extensions",
            "--disable-gpu",
            "--window-size=1365,900",
            "--lang=pt-BR",
            # Sem isto o Chrome headless envia um User-Agent com "HeadlessChrome",
            # que o CDN da Gigavale bloqueia com HTTP 403 antes do formulário de
            # login sequer aparecer. Forçamos um UA de navegador real.
            f"--user-agent={HEADERS['User-Agent']}",
        ]
        if use_headless:
            arguments.insert(0, "--headless=new")
        logger.info("Gigavale: navegador %s", "headless" if use_headless else "visível (headful)")
        for argument in arguments:
            options.add_argument(argument)

        # O login é um AJAX (user-controller.php). Em caso de sucesso a página
        # navega para fora de /entrar; em caso de erro (credenciais, senha
        # inválida, excesso de tentativas) a loja abre um modal SweetAlert.
        # Quando o reCAPTCHA passa em silêncio, um dos dois desfechos aparece
        # em segundos; quando ele exige um desafio (comum em navegador headless)
        # o callback nunca dispara e nada acontece.
        def _login_outcome(browser) -> Optional[str]:
            try:
                if self._is_authenticated_html(browser.page_source):
                    return "ok"
                if "/entrar" not in browser.current_url:
                    return "ok"
                # Leitura do modal de erro via JS: é atômica e evita
                # StaleElementReferenceException enquanto o SweetAlert anima.
                text = browser.execute_script(
                    "var e=document.querySelector("
                    "'.swal2-popup .swal2-html-container, .swal2-html-container, "
                    ".swal2-validation-message');"
                    "return (e && e.offsetParent!==null) ? "
                    "(e.innerText||'').trim() : '';"
                )
                if text:
                    return text
            except WebDriverException:
                return None
            return None

        def _challenge_visible(browser) -> bool:
            # O iframe de desafio do reCAPTCHA (bframe) aparecendo significa que
            # o headless foi flagado; não há como resolvê-lo automaticamente.
            try:
                return bool(browser.execute_script(
                    "var f=document.querySelector('iframe[src*=\"bframe\"]');"
                    "return !!(f && f.offsetParent!==null && "
                    "f.getBoundingClientRect().height>10);"
                ))
            except WebDriverException:
                return False

        driver = None
        try:
            logger.info("Gigavale: iniciando autenticação protegida")

            # O reCAPTCHA headless é não-determinístico: às vezes passa, às vezes
            # exibe um desafio e trava o envio. Cada tentativa usa um navegador
            # NOVO — reutilizar a mesma sessão herda o risco já flagado — e um
            # desafio visível aborta a tentativa na hora, sem esperar o timeout.
            outcome: Optional[str] = None
            for attempt in range(1, self._MAX_LOGIN_ATTEMPTS + 1):
                if driver is not None:
                    try:
                        driver.quit()
                    except Exception:
                        pass
                    driver = None

                driver = self._create_driver(webdriver, options)
                try:
                    driver.execute_cdp_cmd(
                        "Page.addScriptToEvaluateOnNewDocument",
                        {
                            "source": "Object.defineProperty(navigator, 'webdriver', "
                            "{get: () => undefined});"
                        },
                    )
                except Exception:
                    logger.debug("Gigavale: CDP indisponível (WebDriver remoto?)", exc_info=True)
                driver.set_page_load_timeout(30)

                try:
                    driver.get(self.base_url + "/entrar")

                    # O banner de cookies pode cobrir o botão do reCAPTCHA.
                    try:
                        WebDriverWait(driver, 4).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.acceptcookies"))
                        ).click()
                    except TimeoutException:
                        pass

                    wait = WebDriverWait(driver, 20)
                    wait.until(EC.visibility_of_element_located((By.NAME, "email"))).send_keys(username)
                    wait.until(EC.visibility_of_element_located((By.NAME, "senha"))).send_keys(password)
                    submit = wait.until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "button.g-recaptcha"))
                    )
                    # JavaScript click evita interceptação por overlay do reCAPTCHA.
                    driver.execute_script("arguments[0].click();", submit)
                except TimeoutException:
                    logger.info(
                        "Gigavale: tentativa %d/%d — página de login não respondeu, repetindo",
                        attempt, self._MAX_LOGIN_ATTEMPTS,
                    )
                    outcome = None
                    continue

                # Aguarda um desfecho ou detecta o desafio para abortar rápido.
                # Um login bem-sucedido navega em ~2-4s; se em 10s não houve
                # desfecho, o reCAPTCHA travou — recomeça com navegador novo.
                deadline = time.time() + 10
                outcome = None
                while time.time() < deadline:
                    outcome = _login_outcome(driver)
                    if outcome is not None:
                        break
                    if _challenge_visible(driver):
                        outcome = None
                        break
                    time.sleep(1)

                if outcome is not None:
                    break  # desfecho definitivo (sucesso ou modal de erro)
                logger.info(
                    "Gigavale: tentativa %d/%d sem desfecho (reCAPTCHA travou), "
                    "repetindo com navegador novo",
                    attempt, self._MAX_LOGIN_ATTEMPTS,
                )

            if outcome != "ok":
                self.is_logged_in = False
                if outcome:
                    self.login_error = f"A Gigavale recusou o login: {outcome}"
                else:
                    self.login_error = (
                        "A Gigavale não confirmou o login no tempo esperado. "
                        "O reCAPTCHA provavelmente exigiu um desafio "
                        "(comum em navegador headless)."
                    )
                logger.warning("Gigavale: login não confirmado (%s)", outcome or "timeout")
                return False

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

            # Modo "sessão manual": os cookies são semeados por login manual
            # (seed_gigavale_session.py) porque o reCAPTCHA v2 invisível não
            # passa via Selenium. Sem uma sessão válida em cache, NÃO tentamos o
            # login por navegador (gastaria ~60s e falharia no reCAPTCHA) —
            # falhamos rápido com uma instrução clara para re-semear.
            if _manual_session_only():
                self.login_error = (
                    "Sessão manual da Gigavale ausente ou expirada. Rode "
                    "`python seed_gigavale_session.py --interactive` para logar de novo."
                )
                logger.warning("Gigavale: sem sessão manual válida (GIGAVALE_MANUAL_SESSION_ONLY)")
                return False

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

            # O item já passou pelo filtro de preço > 0, então é vendável por
            # padrão. Só marcamos como indisponível diante de um sinal explícito
            # (texto de esgotado ou input de quantidade desabilitado). A simples
            # ausência do input de quantidade no grid não é sinal confiável e
            # marcava todos os produtos como indisponíveis.
            quantity = scope.select_one("input[name^='quantidade']")
            full_text = scope.get_text(" ", strip=True).lower()
            unavailable = (
                (quantity is not None and quantity.has_attr("disabled"))
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
