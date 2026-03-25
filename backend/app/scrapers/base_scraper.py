from abc import ABC, abstractmethod
from typing import List, Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import logging
from app.models.product import ProductOffer
from app.utils.text_normalizer import calculate_similarity

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """
    Classe base abstrata para todos os scrapers de lojas
    Define interface padrão que todos os scrapers devem implementar
    """
    
    def __init__(self, store_name: str, base_url: str, timeout: int = 10):
        self.store_name = store_name
        self.base_url = base_url
        self.timeout = timeout
        self.driver: Optional[webdriver.Chrome] = None
    
    def _init_driver(self, headless: bool = True) -> webdriver.Chrome:
        """Inicializa o driver do Selenium com configurações otimizadas"""
        import os
        import glob as glob_module

        options = Options()

        if headless:
            options.add_argument('--headless=new')

        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-infobars')
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        # Obter caminho do chromedriver - tratando o caso do subdirectório chromedriver-win32
        driver_path = ChromeDriverManager().install()

        # Se o WDM retornar um caminho dentro de uma subpasta (ex: chromedriver-win32/chromedriver.exe)
        # e o arquivo existe lá, usar diretamente
        if not os.path.isfile(driver_path):
            # Tentar encontrar o executável na pasta pai ou subpastas
            base_dir = os.path.dirname(driver_path)
            parent_dir = os.path.dirname(base_dir)
            candidates = (
                glob_module.glob(os.path.join(parent_dir, '**/chromedriver.exe'), recursive=True) +
                glob_module.glob(os.path.join(base_dir, '**/chromedriver.exe'), recursive=True) +
                glob_module.glob(os.path.join(parent_dir, 'chromedriver*.exe'))
            )
            if candidates:
                driver_path = candidates[0]
                logger.info(f"ChromeDriver encontrado em: {driver_path}")

        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(30)

        return driver
    
    def _close_driver(self):
        """Fecha o driver do Selenium"""
        if self.driver:
            try:
                self.driver.quit()
            except Exception as e:
                logger.error(f"Erro ao fechar driver: {e}")
            finally:
                self.driver = None
    
    @abstractmethod
    def search(self, query: str) -> List[ProductOffer]:
        """
        Método abstrato que deve ser implementado por cada scraper
        
        Args:
            query: Termo de busca normalizado
            
        Returns:
            Lista de ProductOffer encontrados
        """
        pass
    
    @abstractmethod
    def login(self, username: str, password: str) -> bool:
        """
        Método para fazer login (se necessário)
        
        Args:
            username: Nome de usuário
            password: Senha
            
        Returns:
            True se login bem-sucedido, False caso contrário
        """
        pass
    
    def _wait_for_element(self, by: By, value: str, timeout: Optional[int] = None) -> Optional[any]:
        """Helper para esperar elemento aparecer"""
        try:
            wait_time = timeout or self.timeout
            element = WebDriverWait(self.driver, wait_time).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except TimeoutException:
            logger.warning(f"Timeout esperando elemento {value}")
            return None
    
    def _safe_find_element(self, by: By, value: str) -> Optional[any]:
        """Helper para buscar elemento sem lançar exceção"""
        try:
            return self.driver.find_element(by, value)
        except NoSuchElementException:
            return None
    
    def _extract_price(self, price_text: str) -> float:
        """Extrai valor numérico de string de preço"""
        try:
            # Remove R$, espaços, e converte vírgula para ponto
            price_clean = price_text.replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.')
            return float(price_clean)
        except (ValueError, AttributeError):
            return 0.0
    
    def _rank_results(self, query: str, offers: List[ProductOffer], limit: Optional[int] = None) -> List[ProductOffer]:
        """
        Ranqueia resultados por score de similaridade e preço
        Formula: (fuzzy_match_score × 0.6) + (price_score × 0.4)

        Args:
            query: Termo de busca
            offers: Lista de ofertas
            limit: Limite de resultados (None = sem limite, retorna todos)
        """
        if not offers:
            return []

        # Calcular scores de similaridade
        for offer in offers:
            similarity_score = calculate_similarity(query, offer.product_name)
            offer.score = similarity_score

        # Ordenar por score (maior primeiro) e depois por preço (menor primeiro)
        ranked = sorted(offers, key=lambda x: (x.score, -x.price), reverse=True)

        # Retornar todos os resultados se limit=None, ou aplicar limite
        return ranked[:limit] if limit else ranked
