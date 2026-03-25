from typing import List, Optional
import logging
import time
import re
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer


logger = logging.getLogger(__name__)


DEFAULT_BASE_URL = "https://www.cofema.com.br"


class CofemaScraper(BaseScraper):
    """
    Scraper para Cofema Atacadista.
    Usa Selenium para login e busca (produtos carregados via AJAX/JavaScript).

    Arquitetura do site (Cofema):
    - Login: modal Bootstrap (#dialog-model) carregado via AJAX (POST /Home/GetLogonPage)
    - Login POST: /Home/Logon com Anti-Forgery Token (__RequestVerificationToken)
    - Busca: produtos carregados via AJAX (POST /Item/GridItens) com infinite scroll
    - Container de produtos: div.GridAjaxPI
    - Cards: div.cat-prod.main-data-add (col-xl-3 col-lg-3 col-md-4 col-sm-6 col-xs-12)
    - Imagem: div.photo > a > img.w-100 (CDN: cdn2.blueintra.com)
    - Nome: .cat-prod-infos > a > h4
    - Preço (logado): .box-values input.radio-value[type=radio] (.val() = float)
    - Preço (fallback): button.btn-add-tocart[data-itempreco]
    - SKU: button.btn-add-tocart[data-itemref] ou .cat-prod-infos[data-itemref]
    """

    def __init__(self):
        super().__init__(
            store_name="Cofema Materiais",
            base_url=DEFAULT_BASE_URL,
            timeout=20,
        )

    def login(self, username: str, password: str) -> bool:
        """Implementação do abstract method — login real ocorre via _login com driver ativo."""
        return True

    def _login(self, driver, username: str, password: str) -> bool:
        """
        Faz login no Cofema usando o driver Selenium já aberto.

        Fluxo do site:
        1. Clicar em "Entre" (a[data-logon="1"]) → abre modal #dialog-model
        2. Modal é carregado via AJAX (POST /Home/GetLogonPage)
        3. Preencher input[name='login'] e input[name='senha']
        4. Clicar #btLogin → dispara POST /Home/Logon com Anti-Forgery Token
        5. Verificar sucesso: input[name='user'] value == 'true'
        """
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        try:
            driver.get(f"{self.base_url}/Home")
            time.sleep(3)

            # ──────────────────────────────────────────────
            # 1. Verificar se já está logado
            # ──────────────────────────────────────────────
            try:
                user_input = driver.find_element(By.CSS_SELECTOR, "input[name='user']")
                if user_input.get_attribute("value") == "true":
                    logger.info(f"✅ Já está logado em {self.store_name}")
                    return True
            except Exception:
                pass

            # Fallback: checar texto na página
            page_src = driver.page_source
            if "/Home/Sair" in page_src or "Área do Cliente" in page_src:
                logger.info(f"✅ Já está logado em {self.store_name}")
                return True

            # ──────────────────────────────────────────────
            # 2. Clicar no botão "Entre" para abrir o modal
            # ──────────────────────────────────────────────
            logger.info("   Abrindo modal de login...")
            btn_entre = None
            for selector in [
                (By.CSS_SELECTOR, "a[data-logon='1']"),
                (By.CSS_SELECTOR, "button[data-logon='1']"),
                (By.XPATH, "//a[contains(normalize-space(.),'Entre') and @data-logon='1']"),
            ]:
                try:
                    btn_entre = WebDriverWait(driver, 8).until(
                        EC.element_to_be_clickable(selector)
                    )
                    break
                except Exception:
                    continue

            if not btn_entre:
                logger.error("   ❌ Botão 'Entre' (a[data-logon='1']) não encontrado")
                return False

            driver.execute_script("arguments[0].scrollIntoView(true);", btn_entre)
            driver.execute_script("arguments[0].click();", btn_entre)
            logger.info("   Clicou em 'Entre' — aguardando modal carregar...")

            # ──────────────────────────────────────────────
            # 3. Aguardar o modal e o form carregarem via AJAX
            #    O modal é #dialog-model e o conteúdo vem de POST /Home/GetLogonPage
            # ──────────────────────────────────────────────
            try:
                WebDriverWait(driver, 10).until(
                    EC.visibility_of_element_located((By.CSS_SELECTOR, "#dialog-model"))
                )
                logger.info("   Modal #dialog-model visível")
            except Exception:
                logger.warning("   ⚠️  Modal não apareceu, tentando encontrar formulário diretamente")

            # Aguardar o input de login aparecer DENTRO do modal (carregado via AJAX)
            try:
                user_input = WebDriverWait(driver, 10).until(
                    EC.visibility_of_element_located(
                        (By.CSS_SELECTOR, "#dialog-model input[name='login'], input[name='login']")
                    )
                )
                logger.info("   Formulário de login carregado no modal")
            except Exception as e:
                logger.error(f"   ❌ Input de login não encontrado: {e}")
                return False

            time.sleep(1)  # pequena espera para garantir renderização completa

            # ──────────────────────────────────────────────
            # 4. Preencher credenciais
            # ──────────────────────────────────────────────
            user_input.clear()
            user_input.send_keys(username)
            logger.info(f"   Login preenchido: {username}")

            pass_input = WebDriverWait(driver, 5).until(
                EC.visibility_of_element_located(
                    (By.CSS_SELECTOR, "#dialog-model input[name='senha']")
                )
            )
            pass_input.clear()
            pass_input.send_keys(password)
            logger.info("   Senha preenchida")

            # ──────────────────────────────────────────────
            # 5. Clicar no botão "Entrar" (#btLogin)
            #    O JS do site faz: $.ajaxAntiForgery({ url: "/Home/Logon", ... })
            #    que automaticamente inclui o __RequestVerificationToken
            # ──────────────────────────────────────────────
            entrar_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, "#dialog-model #btLogin, #dialog-model .btLogin")
                )
            )
            driver.execute_script("arguments[0].click();", entrar_btn)
            logger.info("   Clicou em 'Entrar' — aguardando resposta do servidor...")
            time.sleep(5)

            # ──────────────────────────────────────────────
            # 6. Verificar resultado do login
            # ──────────────────────────────────────────────

            # 6a. Checar mensagem de erro no modal
            try:
                error_el = driver.find_element(By.CSS_SELECTOR, "#msgLoginError")
                if error_el.is_displayed() and error_el.text.strip():
                    logger.error(f"   ❌ Erro no login: {error_el.text.strip()}")
                    return False
            except Exception:
                pass

            # 6b. Checar mensagem de sucesso
            try:
                success_el = driver.find_element(By.CSS_SELECTOR, "#msgLoginSucess")
                if success_el.is_displayed() and success_el.text.strip():
                    logger.info(f"   ✅ Mensagem de sucesso: {success_el.text.strip()}")
            except Exception:
                pass

            # 6c. Fechar modal "Definir configurações" se aparecer após login
            try:
                cfg_btn = WebDriverWait(driver, 4).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, "//button[contains(normalize-space(.),'Definir')]")
                    )
                )
                driver.execute_script("arguments[0].click();", cfg_btn)
                time.sleep(1)
                logger.info("   Modal 'Definir configurações' fechado")
            except Exception:
                pass

            # 6d. Verificação principal: input[name='user'] == 'true'
            #     Este é o indicador usado pelo JS do site
            try:
                user_state = driver.find_element(By.CSS_SELECTOR, "input[name='user']")
                if user_state.get_attribute("value") == "true":
                    logger.info(f"✅ Login bem-sucedido em {self.store_name}")
                    return True
            except Exception:
                pass

            # 6e. Fallback: verificar via page source
            page_src = driver.page_source
            if "/Home/Sair" in page_src or "Área do Cliente" in page_src:
                logger.info(f"✅ Login bem-sucedido em {self.store_name} (verificado via page source)")
                return True

            # Login não confirmado
            title = driver.title
            logger.warning(f"⚠️  Login não confirmado. Título: '{title}' | URL: {driver.current_url}")
            return False

        except Exception as e:
            logger.error(f"❌ Erro no login: {e}", exc_info=True)
            return False

    def _search_with_selenium(self, driver, query: str) -> List[dict]:
        """
        Navega para a página de busca e extrai produtos do DOM renderizado.

        Arquitetura da busca (Cofema):
        - URL: /Produto/Listar/Busca/?q={query}
        - Produtos carregados via AJAX: POST /Item/GridItens
        - Container: div.GridAjaxPI[data-filter="{query}"]
        - Card wrapper: div.cat-prod.main-data-add dentro de col-xl-3.col-lg-3.col-md-4.col-sm-6.col-xs-12
        - Imagem: div.photo > a > img.w-100 (CDN: cdn2.blueintra.com)
        - Nome: .cat-prod-infos > a > h4
        - Preço (logado): .box-values input.radio-value[type=radio] value=float
        - Preço (fallback): button.btn-add-tocart[data-itempreco]
        - SKU: .cat-prod-infos[data-itemref] ou button.btn-add-tocart[data-itemref]
        - Caixa: button.btn-add-tocart[data-qtdecaixa]
        - Estoque: button.btn-add-tocart[data-qtdemax] (0 = sem estoque ou deslogado)
        - Infinite scroll: data-infinite-scroll="true" no GridAjaxPI
        """
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        import urllib.parse

        products = []
        query_encoded = urllib.parse.quote(query)
        search_url = f"{self.base_url}/Produto/Listar/Busca/?q={query_encoded}"

        logger.info(f"   🔍 Navegando para: {search_url}")
        driver.get(search_url)

        # ──────────────────────────────────────────────
        # 1. Aguardar o container GridAjaxPI carregar
        # ──────────────────────────────────────────────
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.GridAjaxPI"))
            )
            logger.info("   Container GridAjaxPI encontrado")
        except Exception:
            logger.warning("   ⚠️  Container GridAjaxPI não encontrado")
            return []

        # ──────────────────────────────────────────────
        # 2. Aguardar os produtos carregarem via AJAX
        #    Os cards têm links para /Item/Detalhes/
        # ──────────────────────────────────────────────
        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "div.GridAjaxPI a[href*='/Item/Detalhes/']")
                )
            )
            logger.info("   Produtos carregados via AJAX")
        except Exception:
            logger.warning(f"   ⚠️  Timeout aguardando produtos. URL: {driver.current_url}")
            # Verificar se há mensagem de "sem resultados"
            try:
                msg_el = driver.find_element(By.CSS_SELECTOR, "div.msg-show")
                if msg_el.text.strip():
                    logger.info(f"   Mensagem do site: {msg_el.text.strip()}")
            except Exception:
                pass
            try:
                body = driver.find_element(By.TAG_NAME, "body")
                logger.warning(f"   Texto da página: {body.text[:400]}")
            except Exception:
                pass
            return []

        # Esperar extra para garantir que os preços foram renderizados
        time.sleep(3)

        # Aguardar que pelos menos um .box-values seja visível (indica login bem-sucedido)
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".box-values"))
            )
            logger.info("   ✅ Preços carregados (login detectado)")
        except Exception:
            logger.warning("   ⚠️  Preços não encontrados — pode não estar logado")

        # ──────────────────────────────────────────────
        # 3. Scroll para carregar mais produtos (infinite scroll)
        #    O site usa data-infinite-scroll="true"
        # ──────────────────────────────────────────────
        self._load_all_products_infinite_scroll(driver)

        # ──────────────────────────────────────────────
        # 4. Extrair todos os cards de produto
        #    Estrutura real: div.cat-prod.main-data-add dentro de colunas Bootstrap
        #    Cada card tem: div.photo (imagem), div.cat-prod-infos (dados), button.btn-add-tocart
        # ──────────────────────────────────────────────
        grid_container = driver.find_element(By.CSS_SELECTOR, "div.GridAjaxPI")

        # Seletor primário: div.cat-prod.main-data-add (wrapper real do card)
        product_cards = grid_container.find_elements(
            By.CSS_SELECTOR, "div.cat-prod.main-data-add"
        )

        if not product_cards:
            # Fallback 1: buscar pelas colunas Bootstrap que contêm links de produto
            col_elements = grid_container.find_elements(
                By.CSS_SELECTOR,
                "div[class*='col-xl-'], div[class*='col-lg-'], div[class*='col-md-']"
            )
            for col in col_elements:
                try:
                    col.find_element(By.CSS_SELECTOR, "a[href*='/Item/Detalhes/']")
                    product_cards.append(col)
                except Exception:
                    continue

        if not product_cards:
            # Fallback 2: qualquer div com link de produto
            product_cards = grid_container.find_elements(
                By.XPATH,
                ".//div[.//a[contains(@href, '/Item/Detalhes/')] and .//img]"
            )
            # Filtrar para pegar os containers mais específicos (folhas)
            if len(product_cards) > 1:
                filtered = []
                for card in product_cards:
                    inner = card.find_elements(
                        By.XPATH, ".//div[.//a[contains(@href, '/Item/Detalhes/')] and .//img]"
                    )
                    if len(inner) <= 1:
                        filtered.append(card)
                if filtered:
                    product_cards = filtered

        if not product_cards:
            logger.warning("   ⚠️  Nenhum card de produto encontrado no GridAjaxPI")
            try:
                html = grid_container.get_attribute("innerHTML")[:2000]
                logger.warning(f"   HTML do grid:\n{html}")
            except Exception:
                pass
            return []

        logger.info(f"   📦 {len(product_cards)} cards de produto encontrados")

        # ──────────────────────────────────────────────
        # 5. Extrair dados de cada card
        # ⚠️ IMPORTANTE: Os cards podem ficar "stale" durante a iteração
        #    (DOM muda por causa de infinite scroll, lazy loading, etc)
        #    Solução: Extrair dados IMEDIATAMENTE durante a iteração
        # ──────────────────────────────────────────────

        # Primeiro, extrair dados básicos de todos os cards (antes que fiquem stale)
        cards_data = []
        for idx, card in enumerate(product_cards, 1):
            try:
                # Extrair APENAS os atributos de URL/ID do card (dados que não mudam)
                try:
                    link = card.find_element(By.CSS_SELECTOR, "a[href*='/Item/Detalhes/']")
                    href = link.get_attribute("href")
                    if href:
                        product_url = href if href.startswith("http") else f"{self.base_url}{href}"
                        cards_data.append({"url": product_url, "idx": idx})
                        if idx <= 5:
                            logger.debug(f"   [Card {idx}] URL extraída: {product_url[:60]}")
                except Exception:
                    continue
            except Exception as e:
                if idx <= 5:
                    logger.debug(f"   [Card {idx}] Erro ao extrair URL: {e}")
                continue

        logger.info(f"   📋 {len(cards_data)} URLs de produtos extraídas (antes que fiquem stale)")

        # Agora processar cada URL extraída (sem dependências de elementos Selenium)
        for data in cards_data:
            try:
                product_url = data["url"]
                idx = data["idx"]

                # Extrair nome da URL (fallback) ou fazer request para obter
                # Para agora, apenas extrair do URL
                import re
                match = re.search(r'/Item/Detalhes/\d+-(.+?)(?:\?|$)', product_url)
                name = match.group(1).replace("-", " ").title() if match else ""

                if len(name) > 2:
                    # Extrair preço E IMAGEM da página de detalhes
                    price, image_url = self._get_price_from_detail_page(product_url, idx)

                    if price > 0 or True:  # Retornar mesmo sem preço para análise
                        products.append({
                            "product_name": name,
                            "product_url": product_url,
                            "price": price,
                            "image_url": image_url,
                            "availability": "em_estoque",
                            "sku": None,
                            "box_qty": None,
                            "category": None,
                            "unit_info": None,
                        })
                        if image_url:
                            logger.debug(f"   [Card {idx}] ✓ {name[:40]} + imagem")
                        else:
                            logger.debug(f"   [Card {idx}] ✓ {name[:40]}")

            except Exception as e:
                logger.debug(f"   Erro ao processar URL: {e}")
                continue

        return products

    def _get_price_from_detail_page(self, product_url: str, idx: int) -> tuple:
        """
        Tenta extrair preço E IMAGEM via Selenium (renderiza JavaScript).

        Args:
            product_url: URL do produto (completa ou relativa)
            idx: Índice do card para logging

        Returns:
            Tupla (preço, image_url) ou (0.0, None) se não encontrado
        """
        from selenium.webdriver.common.by import By

        price = 0.0
        image_url = None

        try:
            # Garantir que temos a URL completa
            if not product_url.startswith("http"):
                product_url = f"{self.base_url}{product_url}"

            # Navegar para a página de detalhes
            self.driver.get(product_url)
            time.sleep(1)  # Aguardar JS renderizar

            # ── Extrair IMAGEM ──
            try:
                # Procurar por imagem principal (várias tentativas de seletor)
                for selector in ["img.w-100", "img.img-fluid", "img[src*='produto']", "img.main-image", "img"]:
                    try:
                        img_el = self.driver.find_element(By.CSS_SELECTOR, selector)
                        src = img_el.get_attribute("src") or img_el.get_attribute("data-src")
                        if src and ("produto" in src.lower() or "cdn" in src.lower()):
                            image_url = src if src.startswith("http") else f"{self.base_url}{src}"
                            logger.debug(f"   [Card {idx}] Imagem: {image_url[:60]}")
                            break
                    except Exception:
                        continue
            except Exception as e:
                logger.debug(f"   [Card {idx}] Erro ao extrair imagem: {e}")

            # ── Extrair PREÇO ──
            body = self.driver.find_element(By.TAG_NAME, "body")
            page_text = body.text

            # Regex para encontrar "R$ X,XX"
            pattern = r'R\$\s*([\d,]+(?:\.\d{2})?|\d+,\d{2})'
            matches = re.findall(pattern, page_text)

            if matches:
                # Pegar o primeiro valor válido (geralmente o preço principal)
                for match in matches:
                    try:
                        val_str = match.replace(".", "").replace(",", ".")
                        p = float(val_str)
                        if p > 0:
                            price = p
                            logger.debug(f"   [Card {idx}] Preço: R$ {p:.2f}")
                            break
                    except (ValueError, TypeError):
                        continue

            return (price, image_url)

        except Exception as e:
            logger.debug(f"   [Card {idx}] Erro: {e}")
            return (0.0, None)

    def _extract_product_from_card(self, card, idx: int) -> Optional[dict]:
        """
        Extrai dados de um card de produto individual.

        ⚠️ ESTRUTURA REAL OBSERVADA (Cofema - layout Vitrine BUSCA):
        Os preços NÃO estão disponíveis na vitrine de busca!
        Precisamos acessar a página /Item/Detalhes para obter o preço.

        Estrutura do card:
        <label class="label-title-vitrine">
          <a class="item-title" data-itemid="11331" href="/Item/Detalhes/11331-...">
            NOME DO PRODUTO
          </a>
        </label>
        <a class="cat-link" ...>Categoria</a>
        <label class="itemcode">
          <span data-cod="11331">Cod: 302740</span>
        </label>

        Solução: Precisamos acessar cada página de detalhes para extrair o preço!
        """
        from selenium.webdriver.common.by import By

        if idx <= 5:
            logger.info(f"   [Card {idx}] Iniciando extração...")

        # ── Nome do produto ──
        name = ""
        product_url = self.base_url
        product_id = None

        # Tentar múltiplos seletores para encontrar o nome
        if idx <= 5:
            logger.info(f"   [Card {idx}] Iniciando busca de nome...")

        seletores = [
            ("a.item-title", "item-title"),
            ("label a[href*='/Item/Detalhes/']", "label-link"),
            ("a[href*='/Item/Detalhes/']", "any-detail-link"),
            (".cat-prod-infos a", "cat-prod-link"),
        ]

        try:
            if idx <= 5:
                logger.info(f"   [Card {idx}] Iterando {len(seletores)} seletores...")
            for seletor, tipo in seletores:
                if name:
                    break
                if idx <= 5:
                    logger.info(f"   [Card {idx}] Testando seletor '{tipo}'...")
                try:
                    links = card.find_elements(By.CSS_SELECTOR, seletor)
                    if idx <= 5:
                        logger.info(f"   [Card {idx}] Seletor '{tipo}': {len(links)} links encontrados")
                    for link in links:
                        text = link.text.strip()
                        if len(text) > 2:
                            name = text
                            href = link.get_attribute("href")
                            if href:
                                product_url = href if href.startswith("http") else f"{self.base_url}{href}"
                            # Tentar extrair data-itemid se existir
                            try:
                                product_id = link.get_attribute("data-itemid")
                            except Exception:
                                pass
                            if idx <= 5:
                                logger.info(f"   [Card {idx}] ✓ Nome via '{tipo}': {name[:50]}")
                            break
                except Exception as e:
                    if idx <= 5:
                        logger.debug(f"   [Card {idx}] Seletor '{tipo}' erro: {e}")
                    continue
        except Exception as e:
            if idx <= 5:
                logger.error(f"   [Card {idx}] Erro geral na extração de nome: {e}", exc_info=True)
            pass

        # DEBUG: Mostrar resultado da extração de nome
        if idx == 2:
            logger.warning(f"\n[CARD {idx}] Nome extraído: '{name}' (len={len(name)})")
            try:
                card_html = card.get_attribute("innerHTML")
                logger.warning(f"[CARD {idx}] HTML:\n{card_html[:800]}\n")
            except Exception as e:
                logger.warning(f"[CARD {idx}] Erro ao ler HTML: {e}")

        if len(name) < 2:
            # DEBUG: Log HTML dos cards rejeitados
            if idx == 2:
                try:
                    card_html = card.get_attribute("innerHTML")
                    logger.warning(f"\n[CARD {idx} HTML]\n{card_html[:1000]}\n")
                except Exception as e:
                    logger.warning(f"   [Card {idx}] Erro ao ler HTML: {e}")
            return None

        # ── Imagem ──
        # Seletor primário: div.photo img.w-100 (imagem direta, sem lazy load)
        image_url = None
        try:
            img_el = card.find_element(By.CSS_SELECTOR, "div.photo img, .photo img")
            image_url = img_el.get_attribute("src")
        except Exception:
            pass

        if not image_url:
            # Fallback: qualquer img dentro do link de detalhes
            try:
                img_el = card.find_element(By.CSS_SELECTOR, "a[href*='/Item/Detalhes/'] img")
                image_url = img_el.get_attribute("src")
            except Exception:
                pass

        if not image_url:
            # Fallback final: qualquer img no card
            try:
                img_el = card.find_element(By.CSS_SELECTOR, "img")
                image_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")
            except Exception:
                pass

        # ── SKU / ID do produto ──
        # Fonte primária: data-itemref no botão (mais confiável)
        sku = None
        try:
            btn = card.find_element(By.CSS_SELECTOR, "button.btn-add-tocart, button.btn-success")
            item_ref = btn.get_attribute("data-itemref")
            if item_ref and item_ref.strip():
                sku = item_ref.strip()
        except Exception:
            pass

        # Fallback: procurar em data-itemref no container principal
        if not sku:
            try:
                infos = card.find_element(By.CSS_SELECTOR, ".cat-prod-infos")
                item_ref = infos.get_attribute("data-itemref")
                if item_ref and item_ref.strip():
                    sku = item_ref.strip()
            except Exception:
                pass

        # Fallback: extrair de qualquer atributo data-itemref
        if not sku:
            try:
                elem_with_ref = card.find_element(By.CSS_SELECTOR, "[data-itemref]")
                item_ref = elem_with_ref.get_attribute("data-itemref")
                if item_ref and item_ref.strip():
                    sku = item_ref.strip()
            except Exception:
                pass

        # ── Quantidade da caixa ──
        box_qty = None
        try:
            btn = card.find_element(By.CSS_SELECTOR, "button.btn-add-tocart")
            qtde_caixa = btn.get_attribute("data-qtdecaixa")
            if qtde_caixa and qtde_caixa != "0":
                box_qty = qtde_caixa
        except Exception:
            pass

        if not box_qty:
            try:
                card_text = card.text
                caixa_match = re.search(r'Caixa:\s*(\d+)', card_text)
                if caixa_match:
                    box_qty = caixa_match.group(1)
            except Exception:
                pass

        # ── Preço ──
        # Na vitrine de busca, os preços NÃO estão disponíveis!
        # Precisamos acessar a página de detalhes para obter o preço
        price = 0.0
        try:
            if product_url and product_url != self.base_url:
                price = self._get_price_from_detail_page(product_url, idx)
            else:
                logger.debug(f"   [Card {idx}] ⚠️  Sem URL de detalhes, não consegui buscar preço")
        except Exception as e:
            logger.debug(f"   [Card {idx}] Erro ao extrair preço de detalhes: {e}")

        # Avisar se não achou preço
        if price == 0:
            logger.warning(f"   [Card {idx}] ⚠️  SEM PREÇO — {name[:40]}")

        # ── Disponibilidade ──
        # Quando indisponível: o botão pode abrir modal OU ter data-qtdemax == "0"
        # Quando disponível: data-qtdemax > 0 no botão
        availability = "em_estoque"

        try:
            btn = card.find_element(By.CSS_SELECTOR, "button.btn-add-tocart, button.btn-success")
            qtde_max = btn.get_attribute("data-qtdemax")
            # Se data-qtdemax == "0", geralmente significa sem estoque (quando logado com preço)
            if qtde_max and qtde_max.strip():
                qtde_val = int(qtde_max.strip())
                if qtde_val == 0 and price > 0:
                    availability = "indisponivel"
        except Exception:
            pass

        # Verificar texto do card para indisponibilidade
        try:
            card_text = card.text.lower()
            if any(word in card_text for word in ["indispon", "esgotado", "sem estoque", "avise-me", "fora de estoque"]):
                availability = "indisponivel"
        except Exception:
            pass

        # ── Categoria ──
        category = None
        try:
            cat_el = card.find_element(
                By.CSS_SELECTOR, "a[href*='/Produto/Listar/Categoria/']"
            )
            category = cat_el.text.strip()
            # Limpar caracteres de ícone font-awesome (char unicode)
            category = re.sub(r'^[\s\uf000-\uf8ff]+', '', category).strip()
            # Remover "a " que vem do <i class="fa">a</i>
            if category.startswith("a "):
                category = category[2:].strip()
        except Exception:
            pass

        # ── Unidade ──
        unit_info = None
        try:
            h5_el = card.find_element(By.CSS_SELECTOR, ".cat-prod-infos h5")
            unit_info = h5_el.text.strip()
        except Exception:
            pass

        # Validação final: produto deve ter nome e preço
        if not name or len(name) < 2:
            logger.debug(f"   [{idx}] ❌ Produto rejeitado: sem nome válido")
            return None

        if price <= 0:
            logger.debug(f"   [{idx}] ⚠️  Produto sem preço: {name[:40]}")
            # Ainda retorna o produto mesmo sem preço, mas com aviso
            # Isso ajuda a diagnosticar problemas de login

        product_data = {
            "product_name": name,
            "product_url": product_url,
            "image_url": image_url,
            "price": price,
            "availability": availability,
            "sku": sku,
            "box_qty": box_qty,
            "category": category,
            "unit_info": unit_info,
        }

        status = f"R${price:.2f}" if price > 0 else "SEM PREÇO"
        logger.debug(
            f"   [{idx}] ✅ {name[:45]:<45} | SKU: {sku} | {status:>15} | {availability}"
        )
        return product_data

    def _load_all_products_infinite_scroll(self, driver, max_scrolls: int = 10):
        """
        Faz scroll para carregar todos os produtos via infinite scroll.
        O site usa data-infinite-scroll="true" no div.GridAjaxPI.

        Args:
            driver: Selenium WebDriver
            max_scrolls: Número máximo de scrolls (proteção contra loop infinito)
        """
        from selenium.webdriver.common.by import By

        previous_count = 0

        for i in range(max_scrolls):
            # Contar produtos atuais
            current_count = len(driver.find_elements(
                By.CSS_SELECTOR, "div.GridAjaxPI a[href*='/Item/Detalhes/']"
            ))

            if current_count == previous_count and i > 0:
                logger.info(f"   Infinite scroll: todos os {current_count} produtos carregados")
                break

            previous_count = current_count

            # Scroll até o final da página
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

            # Também tentar clicar no botão "próxima página" se existir
            try:
                next_btn = driver.find_element(By.CSS_SELECTOR, "#NextPage")
                if next_btn.is_displayed():
                    driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(2)
            except Exception:
                pass

        final_count = len(driver.find_elements(
            By.CSS_SELECTOR, "div.GridAjaxPI a[href*='/Item/Detalhes/']"
        ))
        logger.info(f"   📄 Total após scroll: {final_count} links de produto")

    def search(
        self,
        query: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        region: str = None,
    ) -> List[ProductOffer]:
        """
        Busca produtos no Cofema usando Selenium.

        Args:
            query: Termo de busca (nome do produto)
            username: Login do usuário (CNPJ/email)
            password: Senha
            region: Região (não usado atualmente)

        Returns:
            Lista de ProductOffer com todos os produtos encontrados
        """
        offers = []
        try:
            logger.info(f"🔍 {self.store_name} | query: '{query}'")

            self.driver = self._init_driver(headless=True)

            # Login se credenciais fornecidas
            if username and password:
                login_ok = self._login(self.driver, username, password)
                if not login_ok:
                    logger.warning("⚠️  Login falhou — tentando buscar mesmo assim (preços podem estar ocultos)")
            else:
                logger.info("ℹ️  Sem credenciais — buscando como visitante (preços ocultos)")

            # Buscar produtos
            products = self._search_with_selenium(self.driver, query)
            logger.info(f"📊 Total extraído: {len(products)} produtos")

            # Deduplicar e converter para ProductOffer
            seen = set()
            count_with_price = len([p for p in products if p.get("price", 0) > 0])
            count_without_price = len(products) - count_with_price

            for p in products:
                key = p.get("sku") or p["product_url"]
                if key in seen:
                    continue
                seen.add(key)

                # Apenas adicionar se tiver preço (produto válido)
                if p.get("price", 0) > 0:
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

            if count_without_price > 0:
                logger.warning(f"   ⚠️  {count_without_price} produtos encontrados MAS SEM PREÇO — verifique autenticação")

            # Ranquear por similaridade com o termo buscado
            offers = self._rank_results(query, offers, limit=None)
            logger.info(f"✅ {self.store_name}: {len(offers)} produtos retornados")

        except Exception as e:
            logger.error(f"❌ Erro crítico em {self.store_name}: {e}", exc_info=True)
        finally:
            self._close_driver()

        return offers
