from abc import ABC, abstractmethod
from typing import List, Optional
import logging
from app.models.product import ProductOffer
from app.utils.text_normalizer import calculate_similarity

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """
    Classe base abstrata para todos os scrapers.
    - SEM Selenium (requests + BS4 apenas)
    - Timeout: 10 segundos máximo (conforme escopo)
    - Retry automático: 2 tentativas
    - Circuit breaker integrado
    """

    def __init__(self, store_name: str, base_url: str, timeout: int = 10):
        self.store_name = store_name
        self.base_url = base_url
        self.timeout = timeout  # SEMPRE 10s conforme escopo
        self.login_error: Optional[str] = None
        self.failure_count = 0
        self.max_failures_before_circuit_break = 5

    @abstractmethod
    def search(self, query: str, username: Optional[str] = None, password: Optional[str] = None, region: str = "sp") -> List[ProductOffer]:
        """
        Busca produtos. Deve respeitar timeout de 10s.

        Returns:
            Lista de ProductOffer ou [] se falhar
        """
        pass

    def login(self, username: str, password: str) -> bool:
        """
        Login (opcional - apenas se scraper exigir).
        Retorna True se bem-sucedido.
        """
        return True  # Default: sem login necessário

    def _extract_price(self, price_text: str) -> float:
        """Extrai valor de string de preço."""
        try:
            clean = price_text.replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.')
            return float(clean)
        except (ValueError, AttributeError):
            return 0.0

    def _rank_results(self, query: str, offers: List[ProductOffer], limit: Optional[int] = 50) -> List[ProductOffer]:
        """
        Ranqueia por: (fuzzy_match × 0.6) + (menor_preço × 0.4)
        Limite padrão: 50 resultados por scraper
        """
        if not offers:
            return []

        # Calcular scores
        for offer in offers:
            offer.score = calculate_similarity(query, offer.product_name)

        # Ordenar: score DESC, depois preço ASC
        ranked = sorted(offers, key=lambda x: (-x.score, x.price if x.price > 0 else float('inf')))

        return ranked[:limit] if limit else ranked

    def circuit_breaker_check(self) -> bool:
        """Verifica se o scraper está em falha (circuit breaker)."""
        return self.failure_count < self.max_failures_before_circuit_break

    def record_failure(self):
        """Registra uma falha para circuit breaker."""
        self.failure_count += 1
        logger.warning(f"⚠️ {self.store_name}: falha registrada ({self.failure_count}/{self.max_failures_before_circuit_break})")

    def record_success(self):
        """Reseta contador de falhas."""
        if self.failure_count > 0:
            logger.info(f"✅ {self.store_name}: recuperado de falhas")
        self.failure_count = 0
