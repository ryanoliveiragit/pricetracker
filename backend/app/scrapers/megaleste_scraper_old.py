from typing import List
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import logging
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

logger = logging.getLogger(__name__)


class MegalesteScraper(BaseScraper):
    """
    Scraper para Estoque Megaleste (www.megaleste.com.br)
    """
    
    def __init__(self):
        super().__init__(
            store_name="Estoque Megaleste",
            base_url="https://www.megaleste.com.br",
            timeout=15
        )
        self.is_logged_in = False
    
    def login(self, username: str, password: str) -> bool:
        """
        Executa o fluxo real de login na Megaleste
        """
        try:
            if not self.driver:
                self.driver = self._init_driver(headless=True)
            
            logger.info(f"Iniciando login em {self.store_name} com {username}")
            self.driver.get(self.base_url)
            
            # Aguardar o botão de usuário carregar e clicar
            user_menu_btn = self._wait_for_element(By.CSS_SELECTOR, "a[role='button']")
            if not user_menu_btn:
                logger.error("Botão de menu do usuário não encontrado.")
                return False
            
            user_menu_btn.click()
            time.sleep(1) # Aguardar modal
            
            # Preencher inputs de login
            email_input = self._wait_for_element(By.CSS_SELECTOR, "input[placeholder='login']")
            pass_input = self._wait_for_element(By.CSS_SELECTOR, "input[placeholder='senha']")
            
            if not email_input or not pass_input:
                logger.error("Campos de login não encontrados no modal.")
                return False
                
            email_input.clear()
            email_input.send_keys(username)
            pass_input.clear()
            pass_input.send_keys(password)
            
            # Encontrar e clicar no botão 'entrar'
            try:
                submit_btn = self.driver.find_element(By.XPATH, "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'entrar')]")
                submit_btn.click()
            except:
                # Fallback: pressionar ENTER no campo de senha
                pass_input.send_keys(Keys.RETURN)
            
            # Aguardar redirecionamento/fechamento do modal
            time.sleep(4)
            
            # Checar se login deu erro (ex: mensagem de "senha incorreta")
            error_msg = self._safe_find_element(By.XPATH, "//*[contains(text(), 'incorreta') or contains(text(), 'inválido')]")
            if error_msg:
                logger.warning(f"Credenciais inválidas para {self.store_name}")
                return False
                
            self.is_logged_in = True
            logger.info(f"Login finalizado em {self.store_name}")
            return True
            
        except Exception as e:
            logger.error(f"Erro durante login em {self.store_name}: {e}")
            return False

    def search(self, query: str, username: str = None, password: str = None) -> List[ProductOffer]:
        """
        Busca produtos no site, efetuando login se necessário.
        """
        offers = []
        try:
            self.driver = self._init_driver(headless=True)
            
            # Executar login antes de buscar
            if username and password and not self.is_logged_in:
                success = self.login(username, password)
                if not success:
                    logger.warning(f"Abortando busca em {self.store_name} devido a falha no login.")
                    return []
            
            logger.info(f"Buscando '{query}' em {self.store_name}...")
            
            # Navegar diretamente para a rota de busca passando o parâmetro q
            search_url = f"{self.base_url}/c/busca?q={query}"
            self.driver.get(search_url)
            
            # Aguardar carregamento dos resultados
            time.sleep(4) 
            
            # Estratégia flexível de extração de produtos com base no layout real (logado)
            product_elements = self.driver.find_elements(By.CSS_SELECTOR, ".item-produto")

            logger.info(f"Total de produtos encontrados na página: {len(product_elements)}")

            # Processar TODOS os produtos encontrados (sem limite)
            for element in product_elements:
                try:
                    name_elem = element.find_element(By.CSS_SELECTOR, "h4")
                    # Tentar primeiro o preço com desconto (vermelho), se não achar tenta class genérica
                    try:
                        price_elem = element.find_element(By.CSS_SELECTOR, ".price-red")
                    except:
                        price_elem = element.find_element(By.CSS_SELECTOR, ".precos span:last-child")

                    link_elem = element.find_element(By.CSS_SELECTOR, "a.btn-modal.show-lupa, a, .thumb a")

                    product_name = name_elem.text.strip()
                    price_text = price_elem.text.strip()
                    product_url = link_elem.get_attribute('href')

                    # Tentar extrair imagem
                    image_url = None
                    try:
                        img_elem = element.find_element(By.CSS_SELECTOR, "img")
                        image_url = img_elem.get_attribute('src') or img_elem.get_attribute('data-src')
                    except:
                        pass

                    # Tentar extrair SKU/código
                    sku = None
                    try:
                        sku_elem = element.find_element(By.CSS_SELECTOR, ".codigo, .sku, [data-sku]")
                        sku = sku_elem.text.strip() or sku_elem.get_attribute('data-sku')
                    except:
                        pass

                    # Verificar disponibilidade
                    availability = "em_estoque"
                    try:
                        unavailable_elem = element.find_element(By.XPATH, ".//*[contains(text(), 'indispon') or contains(text(), 'esgotado')]")
                        if unavailable_elem:
                            availability = "indisponivel"
                    except:
                        pass

                    price = self._extract_price(price_text)

                    if price > 0 and product_name:
                        offers.append(ProductOffer(
                            store=self.store_name,
                            product_name=product_name,
                            price=price,
                            currency="BRL",
                            product_url=product_url,
                            add_to_cart_url=product_url,
                            availability=availability,
                            sku=sku,
                            image_url=image_url
                        ))
                except Exception as e:
                    logger.debug(f"Erro ao processar elemento de produto: {e}")
                    continue

            # Ranquear resultados sem limite (retorna todos)
            offers = self._rank_results(query, offers, limit=None)
            logger.info(f"Encontrados {len(offers)} resultados válidos em {self.store_name}")
            
        except Exception as e:
            logger.error(f"Erro ao buscar em {self.store_name}: {e}")
        
        finally:
            self._close_driver()
            self.is_logged_in = False
            
        return dict((o.product_url, o) for o in offers).values() # Remove URLs duplicadas
