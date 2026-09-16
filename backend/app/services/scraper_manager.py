"""
Gerenciador centralizado de scrapers com:
- Execução paralela eficiente
- Cache com TTL (banco de dados)
- Circuit breaker para lojas problemáticas
- Logging estruturado de performance
- Timeout rigoroso de 10s por loja
"""

import asyncio
import logging
import time
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor
from app.models.product import ProductOffer
from app.services.cache import db_cache_get, db_cache_set, record_scrape_time_db
from app.utils.text_normalizer import normalize_text

logger = logging.getLogger(__name__)

SCRAPER_TIMEOUT = 30  # Login + busca em lojas que exigem autenticação podem levar até 25s
# Alguns fornecedores exigem login por navegador real (Selenium + reCAPTCHA), o
# que passa dos 30s no primeiro acesso. Depois de logado a sessão fica em cache,
# então esse tempo maior só afeta a primeira busca.
SCRAPER_TIMEOUTS = {
    "gigavale": 75,
}


def _timeout_for(scraper_key: str) -> int:
    return SCRAPER_TIMEOUTS.get(scraper_key, SCRAPER_TIMEOUT)
SEARCH_CACHE_TTL = 1800  # 30 minutos
MAX_WORKERS = 5
CIRCUIT_BREAKER_THRESHOLD = 5  # Após 5 falhas, pula a loja
CIRCUIT_BREAKER_TIMEOUT = 300  # 5 minutos antes de tentar novamente


class ScraperManager:
    """Orquestra execução paralela de scrapers com cache e resiliência."""

    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
        self.circuit_breakers: Dict[str, Dict] = {}  # scraper_key -> {failures, last_failure_time}

    def _get_circuit_breaker_state(self, scraper_key: str) -> Dict:
        """Obtém ou cria estado do circuit breaker."""
        if scraper_key not in self.circuit_breakers:
            self.circuit_breakers[scraper_key] = {
                "failures": 0,
                "last_failure_time": None,
                "is_open": False
            }
        return self.circuit_breakers[scraper_key]

    def _check_circuit_breaker(self, scraper_key: str) -> bool:
        """
        Verifica se o scraper pode executar.
        Retorna False se circuit breaker está aberto (muitas falhas recentes).
        """
        state = self._get_circuit_breaker_state(scraper_key)

        if state["is_open"]:
            time_since_failure = time.time() - (state["last_failure_time"] or 0)
            if time_since_failure > CIRCUIT_BREAKER_TIMEOUT:
                # Timeout expirou, resetar circuit breaker
                logger.info(f"🔄 {scraper_key}: reabrindo circuit breaker após timeout")
                state["failures"] = 0
                state["is_open"] = False
                return True
            else:
                remaining = int(CIRCUIT_BREAKER_TIMEOUT - time_since_failure)
                logger.warning(f"⏸️ {scraper_key}: circuit breaker aberto. Retry em {remaining}s")
                return False

        return True

    def _record_success(self, scraper_key: str):
        """Registra sucesso e reseta circuit breaker."""
        state = self._get_circuit_breaker_state(scraper_key)
        if state["failures"] > 0:
            logger.info(f"✅ {scraper_key}: recuperado após {state['failures']} falhas")
        state["failures"] = 0
        state["is_open"] = False

    def _record_failure(self, scraper_key: str):
        """Registra falha. Se atingir limite, abre circuit breaker."""
        state = self._get_circuit_breaker_state(scraper_key)
        state["failures"] += 1
        state["last_failure_time"] = time.time()

        if state["failures"] >= CIRCUIT_BREAKER_THRESHOLD:
            state["is_open"] = True
            logger.error(f"⛔ {scraper_key}: circuit breaker ativado após {CIRCUIT_BREAKER_THRESHOLD} falhas")
        else:
            logger.warning(f"⚠️ {scraper_key}: falha {state['failures']}/{CIRCUIT_BREAKER_THRESHOLD}")

    async def scrape_store_async(
        self,
        scraper_class,
        query: str,
        scraper_key: str,
        credentials: Optional[Dict] = None,
        force_refresh: bool = False,
    ) -> Tuple[List[ProductOffer], float, str, Optional[str]]:
        """
        Executa scraper com timeout rigoroso de 10 segundos.

        Returns:
            (offers, duration_ms, scraper_key, error_msg)
        """
        query_norm = normalize_text(query)

        # Verificar circuit breaker
        if not self._check_circuit_breaker(scraper_key):
            return [], 0, scraper_key, f"Circuit breaker ativo (loja temporariamente indisponível)"

        # Verificar cache (se não é force refresh)
        if not force_refresh:
            cached = await db_cache_get(scraper_key, query_norm, ttl_seconds=SEARCH_CACHE_TTL)
            if cached is not None:
                # Desserialização defensiva: uma linha de cache antiga com schema
                # incompatível (ex.: campo novo/renomeado após deploy) NÃO pode
                # derrubar a busca inteira — se falhar, ignora o cache e segue
                # para o scrape ao vivo em vez de propagar ValidationError.
                try:
                    offers = [ProductOffer(**item) for item in cached]
                    logger.info(f"💾 {scraper_key}:{query_norm} — cache hit")
                    return offers, 0, scraper_key, None
                except Exception as _cache_err:
                    logger.warning(
                        f"⚠️ {scraper_key}:{query_norm} — cache incompatível, "
                        f"ignorando e re-scrapeando ({type(_cache_err).__name__})"
                    )

        # Executar scraping com timeout (maior para lojas com login via navegador)
        scraper_timeout = _timeout_for(scraper_key)
        t0 = time.time()
        try:
            loop = asyncio.get_event_loop()
            offers = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    self._run_scraper,
                    scraper_class,
                    query_norm,
                    credentials,
                ),
                timeout=scraper_timeout
            )

            duration = time.time() - t0

            if isinstance(offers, tuple) and len(offers) == 2:
                # Retorno é (ofertas, erro)
                offers, error = offers
                if error:
                    self._record_failure(scraper_key)
                    logger.error(f"❌ {scraper_key}:{query_norm} — {error}")
                    return [], duration, scraper_key, error
                else:
                    # Sucesso (tuple sem erro)
                    if offers:
                        await db_cache_set(scraper_key, query_norm, [o.model_dump() for o in offers])
                    self._record_success(scraper_key)
                    await record_scrape_time_db(scraper_key, duration, query_norm)
                    logger.info(f"✅ {scraper_key}:{query_norm} — {len(offers)} produtos ({duration:.1f}s)")
                    return offers, duration, scraper_key, None
            else:
                # Sucesso (list direto, backwards compat)
                if offers:
                    await db_cache_set(scraper_key, query_norm, [o.model_dump() for o in offers])
                self._record_success(scraper_key)
                await record_scrape_time_db(scraper_key, duration, query_norm)
                logger.info(f"✅ {scraper_key}:{query_norm} — {len(offers)} produtos ({duration:.1f}s)")
                return offers, duration, scraper_key, None

        except asyncio.TimeoutError:
            duration = time.time() - t0
            self._record_failure(scraper_key)
            error_msg = f"Timeout após {scraper_timeout}s"
            logger.error(f"⏱️ {scraper_key}:{query_norm} — {error_msg}")
            return [], duration, scraper_key, error_msg

        except Exception as e:
            duration = time.time() - t0
            self._record_failure(scraper_key)
            error_msg = str(e)
            logger.error(f"❌ {scraper_key}:{query_norm} — {error_msg}", exc_info=True)
            return [], duration, scraper_key, error_msg

        return [], time.time() - t0, scraper_key, "Erro desconhecido"

    def _run_scraper(self, scraper_class, query: str, credentials: Optional[Dict]) -> Tuple[List[ProductOffer], Optional[str]]:
        """
        Executa o scraper em thread separada.
        Retorna (ofertas, erro).
        """
        try:
            scraper = scraper_class()

            # Configurar URL se fornecida
            if credentials and credentials.get('url'):
                from urllib.parse import urlparse
                parsed = urlparse(credentials['url'])
                scraper.base_url = f"{parsed.scheme}://{parsed.netloc}"

            username = (credentials or {}).get('username')
            password = (credentials or {}).get('password')
            region = (credentials or {}).get('region', 'sp')

            # Passar credenciais diretamente ao search() — cada scraper lida do seu jeito
            import inspect
            sig = inspect.signature(scraper.search)
            params = sig.parameters

            if username and password:
                kwargs = {}
                if 'username' in params:
                    kwargs['username'] = username
                if 'password' in params:
                    kwargs['password'] = password
                if 'region' in params:
                    kwargs['region'] = region
                offers = scraper.search(query, **kwargs)
            else:
                offers = scraper.search(query)

            # Verificar login_error após busca (alguns scrapers setam isso internamente)
            login_error = getattr(scraper, 'login_error', None)
            if login_error:
                return [], login_error

            return offers, None

        except Exception as e:
            return [], str(e)

    async def scrape_all_stores_parallel(
        self,
        scrapers_with_creds: List[Tuple],  # [(scraper_class, credentials, scraper_key), ...]
        query: str,
        force_refresh: bool = False,
    ) -> List[ProductOffer]:
        """
        Executa todos os scrapers em paralelo com timeout rigoroso.

        Args:
            scrapers_with_creds: Lista de (scraper_class, credentials, scraper_key)
            query: Termo de busca
            force_refresh: Ignorar cache

        Returns:
            Lista dedupilcada de ofertas
        """
        tasks = [
            self.scrape_store_async(scraper_class, query, key, creds, force_refresh)
            for scraper_class, creds, key in scrapers_with_creds
        ]

        # return_exceptions=True: uma loja que estoura exceção não pode descartar
        # os resultados de TODAS as outras lojas já concluídas com sucesso.
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_offers: List[ProductOffer] = []
        seen_keys: set = set()

        for result in results:
            if isinstance(result, BaseException):
                logger.error(f"Scraper task falhou: {type(result).__name__}: {result}")
                continue
            offers, duration, scraper_key, error = result
            for offer in offers:
                key = f"{offer.store}:{offer.sku or offer.product_name[:30].lower()}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_offers.append(offer)

        return all_offers

    def get_health_status(self) -> Dict[str, Dict]:
        """Retorna status de cada scraper (para monitoramento)."""
        return {
            key: {
                "failures": state["failures"],
                "is_open": state["is_open"],
                "last_failure_time": state.get("last_failure_time"),
            }
            for key, state in self.circuit_breakers.items()
        }


# Instância global
_manager: Optional[ScraperManager] = None


def get_scraper_manager() -> ScraperManager:
    """Obtém instância singleton do manager."""
    global _manager
    if _manager is None:
        _manager = ScraperManager()
    return _manager
