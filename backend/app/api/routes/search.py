from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Type
import asyncio
import json
import logging
import time
import httpx
from concurrent.futures import ThreadPoolExecutor
from app.models.product import (
    SearchRequest, SearchResponse, SearchItemResult, ProductOffer,
    ProductSearchBySupplierRequest, ProductSearchBySupplierResponse
)
from app.utils.text_normalizer import normalize_text
from app.services.synonyms import get_synonyms
from app.scrapers.base_scraper import BaseScraper
from app.database import async_session
from app.models.db_models import ProductDB
from sqlalchemy import select
from app.scrapers.megaleste_scraper import MegalesteScraper
from app.scrapers.cofema_scraper import CofemaScraper
from app.scrapers.estoque_atacadista_scraper import EstoqueAtacadistaScraper
from app.services.credentials_manager import get_credentials_manager
from app.services.cache import (
    db_cache_get, db_cache_set, db_cache_clear,
    record_scrape_time_db, get_estimated_wait_db, get_all_estimates_db,
    mem_cache_get, mem_cache_set,
)
import os

logger = logging.getLogger(__name__)
router = APIRouter()

# Configurações
MAX_WORKERS = int(os.getenv("MAX_CONCURRENT_SCRAPERS", "5"))
CACHE_TTL = int(os.getenv("SEARCH_CACHE_TTL", "1800"))  # 30 minutos padrão


async def get_db_variants(query: str) -> List[str]:
    """
    Busca no banco se algum produto cadastrado tem o query como nome ou variante.
    Retorna todas as variantes do produto encontrado, ou [query] se não houver.
    """
    q = query.strip().lower()
    try:
        async with async_session() as session:
            result = await session.execute(select(ProductDB))
            for product in result.scalars().all():
                name_lower = product.name.strip().lower()
                all_variants = [v.strip().lower() for v in (product.variants or []) if v.strip()]
                all_terms = [name_lower] + all_variants
                # Match exato primeiro
                if q in all_terms:
                    return [product.name] + (product.variants or [])
                # Match parcial: query contém o nome ou vice-versa
                if name_lower in q or q in name_lower:
                    return [product.name] + (product.variants or [])
                for variant in all_variants:
                    if variant in q or q in variant:
                        return [product.name] + (product.variants or [])
    except Exception as e:
        logger.warning(f"Erro ao buscar variantes no DB: {e}")
    return [query]


def scrape_store(scraper_class, query: str, credentials: dict = None) -> tuple:
    """
    Executa scraping em uma loja específica.
    Retorna (results, duration_seconds, scraper_key).
    """
    scraper_key = scraper_class.__name__.lower().replace("scraper", "").strip("_")
    t0 = time.time()
    try:
        scraper = scraper_class()

        if credentials and credentials.get('url'):
            from urllib.parse import urlparse
            parsed = urlparse(credentials['url'])
            scraper.base_url = f"{parsed.scheme}://{parsed.netloc}"

        if credentials and hasattr(scraper, 'search') and 'username' in credentials:
            region = credentials.get('region') or 'sp'
            results = scraper.search(query, credentials['username'], credentials['password'], region=region)
        else:
            results = scraper.search(query)

        duration = time.time() - t0
        return (results, duration, scraper_key)

    except Exception as e:
        logger.error(f"Erro ao executar scraper {scraper_class.__name__}: {e}")
        return ([], time.time() - t0, scraper_key)


async def search_all_stores(query: str, force_refresh: bool = False) -> List[ProductOffer]:
    """
    Busca em todas as lojas em paralelo com cache PostgreSQL.
    Cache inteligente: verifica TTL, atualiza quando necessário.
    """
    from app.api.routes.suppliers import get_all_suppliers_from_db

    scrapers = []

    keyword_mapping = {
        "megaleste": MegalesteScraper,
        "cofema": CofemaScraper,
        "atacadista": EstoqueAtacadistaScraper,
    }

    def resolve_scraper(name: str):
        normalized = name.lower().strip()
        for keyword, cls in keyword_mapping.items():
            if keyword in normalized:
                return cls
        return None

    logger.info("Buscando fornecedores ativos do banco de dados...")
    all_suppliers = await get_all_suppliers_from_db()
    active_suppliers = [s for s in all_suppliers if s.is_active]

    if not active_suppliers:
        logger.warning("⚠️  Nenhum fornecedor ativo encontrado")
        scrapers = [(MegalesteScraper, None)]
    else:
        seen_scrapers = set()
        for supplier in active_suppliers:
            scraper_class = resolve_scraper(supplier.name)
            if not scraper_class or scraper_class in seen_scrapers:
                if not scraper_class:
                    logger.info(f"   ⚠️  {supplier.name}: sem scraper implementado")
                continue

            seen_scrapers.add(scraper_class)
            credentials = {
                'url': supplier.url or '',
                'region': supplier.region or 'sp',
            }
            if supplier.requires_login and supplier.username and supplier.password:
                credentials['username'] = supplier.username
                credentials['password'] = supplier.password
            scrapers.append((scraper_class, credentials))

        logger.info(f"✅ {len(scrapers)} scrapers resolvidos")

    # ── Verificar cache por scraper (PostgreSQL) ──
    scrapers_to_run = []
    all_offers: List[ProductOffer] = []

    for scraper_class, credentials in scrapers:
        scraper_key = scraper_class.__name__.lower().replace("scraper", "").strip("_")

        if not force_refresh:
            cached = await db_cache_get(scraper_key, query, ttl_seconds=CACHE_TTL)
            if cached is not None:
                all_offers.extend([ProductOffer(**item) for item in cached])
                continue

        if force_refresh:
            logger.info(f"   🔄 FORCE REFRESH — {scraper_key}:{query}")
        scrapers_to_run.append((scraper_class, credentials))

    # ── Executar scrapers não cacheados em paralelo ──
    SCRAPER_TIMEOUT = int(os.getenv("SCRAPER_TIMEOUT_SECONDS", "45"))

    if scrapers_to_run:
        logger.info(f"🚀 Executando {len(scrapers_to_run)} scrapers sem cache (timeout={SCRAPER_TIMEOUT}s)...")
        loop = asyncio.get_event_loop()

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = [
                loop.run_in_executor(executor, scrape_store, scraper_class, query, credentials)
                for scraper_class, credentials in scrapers_to_run
            ]
            try:
                raw_results = await asyncio.wait_for(
                    asyncio.gather(*futures, return_exceptions=True),
                    timeout=SCRAPER_TIMEOUT,
                )
            except asyncio.TimeoutError:
                logger.warning(f"⏱️ Timeout ({SCRAPER_TIMEOUT}s) atingido ao buscar '{query}'")
                raw_results = []

        for raw in raw_results:
            if isinstance(raw, Exception):
                logger.error(f"Erro em scraper: {raw}")
                continue
            offers, duration, scraper_key = raw
            if isinstance(offers, list):
                # Só salvar no cache se teve resultados (evita cachear erros de login)
                if offers:
                    await db_cache_set(scraper_key, query, [o.model_dump() for o in offers])
                else:
                    logger.warning(f"   ⚠️  {scraper_key}:{query} retornou 0 produtos — NÃO cacheado")
                await record_scrape_time_db(scraper_key, duration, query)
                logger.info(f"   ✅ Scraping concluído — {scraper_key}:{query} ({len(offers)} produtos, {duration:.1f}s)")
                all_offers.extend(offers)

    logger.info(f"Total de ofertas encontradas: {len(all_offers)}")
    return all_offers


@router.post("/search", response_model=SearchResponse)
async def search_products(request: SearchRequest):
    return await _search_products_inner(request)


@router.post("/search/stream")
async def search_stream(request: SearchRequest):
    """
    Streaming SSE: envia resultados por fornecedor assim que cada um termina.
    """
    async def generate():
        from app.api.routes.suppliers import get_all_suppliers_from_db

        keyword_mapping = {
            "megaleste": MegalesteScraper,
            "cofema": CofemaScraper,
            "atacadista": EstoqueAtacadistaScraper,
        }

        all_suppliers = await get_all_suppliers_from_db()
        active_suppliers = [s for s in all_suppliers if s.is_active]
        scrapers = []

        if not active_suppliers:
            scrapers = [(MegalesteScraper, None, "Megaleste")]
        else:
            seen = set()
            for supplier in active_suppliers:
                normalized = supplier.name.lower().strip()
                scraper_class = next((cls for kw, cls in keyword_mapping.items() if kw in normalized), None)
                if not scraper_class or scraper_class in seen:
                    continue
                seen.add(scraper_class)
                creds = {"url": supplier.url or "", "region": supplier.region or "sp"}
                if supplier.requires_login and supplier.username and supplier.password:
                    creds["username"] = supplier.username
                    creds["password"] = supplier.password
                scrapers.append((scraper_class, creds, supplier.name))

        # Expandir sinônimos uma vez
        all_queries: list[str] = []
        for item in request.items:
            normalized = normalize_text(item)
            db_terms = await get_db_variants(normalized)
            terms = db_terms if len(db_terms) > 1 else get_synonyms(normalized)
            all_queries.extend(terms)

        loop = asyncio.get_event_loop()

        for scraper_class, credentials, store_name in scrapers:
            t0 = time.time()
            try:
                # Coleta ofertas de todos os sinônimos para este fornecedor
                store_offers: list[ProductOffer] = []
                seen_keys: set[str] = set()

                for sq in all_queries:
                    sq_norm = normalize_text(sq)
                    scraper_key = scraper_class.__name__.lower().replace("scraper", "").strip("_")

                    # Checar cache
                    cached = await db_cache_get(scraper_key, sq_norm, ttl_seconds=CACHE_TTL)
                    if cached is not None:
                        for item in cached:
                            offer = ProductOffer(**item)
                            key = f"{offer.store}:{offer.sku or offer.product_name[:30].lower()}"
                            if key not in seen_keys:
                                seen_keys.add(key)
                                store_offers.append(offer)
                        continue

                    raw = await loop.run_in_executor(
                        None, scrape_store, scraper_class, sq_norm, credentials
                    )
                    if isinstance(raw, Exception):
                        continue
                    offers, duration, _ = raw
                    if offers:
                        await db_cache_set(scraper_key, sq_norm, [o.model_dump() for o in offers])
                    await record_scrape_time_db(scraper_key, duration, sq_norm)
                    for offer in offers:
                        key = f"{offer.store}:{offer.sku or offer.product_name[:30].lower()}"
                        if key not in seen_keys:
                            seen_keys.add(key)
                            store_offers.append(offer)

                payload = json.dumps({
                    "store": store_name,
                    "duration_ms": int((time.time() - t0) * 1000),
                    "offers": [o.model_dump() for o in store_offers],
                    "done": False,
                })
                yield f"data: {payload}\n\n"

            except Exception as e:
                logger.error(f"Stream error [{store_name}]: {e}")
                yield f"data: {json.dumps({'store': store_name, 'offers': [], 'done': False, 'error': str(e)})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


async def _search_products_inner(request: SearchRequest) -> SearchResponse:
    try:
        t_total = time.time()
        results = []

        for item in request.items:
            normalized_query = normalize_text(item)
            logger.info(f"Buscando: {item} (normalizado: {normalized_query})")

            t_item = time.time()

            # Expandir query: primeiro variantes do DB, fallback para sinônimos estáticos
            db_terms = await get_db_variants(normalized_query)
            if len(db_terms) > 1:
                synonym_queries = db_terms
                logger.info(f"Variantes do DB para '{normalized_query}': {synonym_queries}")
            else:
                synonym_queries = get_synonyms(normalized_query)
                logger.info(f"Sinônimos estáticos para '{normalized_query}': {synonym_queries}")

            all_offers: List[ProductOffer] = []
            seen: set[str] = set()

            def _merge(offers_list):
                for sq_offers in offers_list:
                    if isinstance(sq_offers, Exception):
                        continue
                    for offer in sq_offers:
                        key = f"{offer.store}:{offer.sku or offer.product_name[:30].lower()}"
                        if key not in seen:
                            seen.add(key)
                            all_offers.append(offer)

            # Buscar termo principal primeiro — se já tiver resultados, sinônimos rodam em paralelo
            main_offers = await search_all_stores(normalized_query, force_refresh=request.force_refresh)
            _merge([main_offers])

            # Sinônimos extras (excluindo o principal que já foi buscado)
            extra_queries = [sq for sq in synonym_queries if normalize_text(sq) != normalized_query]
            if extra_queries:
                tasks = [
                    search_all_stores(normalize_text(sq), force_refresh=request.force_refresh)
                    for sq in extra_queries
                ]
                extra_results = await asyncio.gather(*tasks, return_exceptions=True)
                _merge(extra_results)

            offers = all_offers
            item_ms = int((time.time() - t_item) * 1000)

            # Marcar melhor preço
            prices_with_value = [offer.price for offer in offers if offer.price > 0]
            if offers and prices_with_value:
                min_price = min(prices_with_value)
                for offer in offers:
                    if offer.price == min_price:
                        offer.product_name = f"✓ {offer.product_name}"

            results.append(SearchItemResult(
                raw_query=item,
                normalized_query=normalized_query,
                offers=offers,
                search_duration_ms=item_ms,
            ))

        all_stores = set()
        for result in results:
            for offer in result.offers:
                all_stores.add(offer.store)

        estimates = await get_all_estimates_db()

        return SearchResponse(
            items=results,
            total_items=len(results),
            stores=sorted(list(all_stores)),
            total_duration_ms=int((time.time() - t_total) * 1000),
            estimated_wait_seconds=estimates,
        )

    except Exception as e:
        logger.error(f"Erro na busca: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar busca: {str(e)}")


@router.post("/search-by-supplier", response_model=ProductSearchBySupplierResponse)
async def search_by_supplier(request: ProductSearchBySupplierRequest):
    """
    Endpoint para buscar produtos por nome em um fornecedor específico.
    """
    try:
        if not request.product_name or len(request.product_name.strip()) < 2:
            raise HTTPException(
                status_code=400,
                detail="Nome do produto deve ter pelo menos 2 caracteres"
            )

        normalized_query = normalize_text(request.product_name)
        logger.info(f"Buscando '{request.product_name}' em {request.supplier_name} (ID: {request.supplier_id})")

        scraper_mapping: Dict[str, Type[BaseScraper]] = {
            "Estoque Megaleste": MegalesteScraper,
            "megaleste": MegalesteScraper,
            "Cofema Materiais": CofemaScraper,
            "cofema": CofemaScraper,
            "Estoque Atacadista": EstoqueAtacadistaScraper,
            "estoque_atacadista": EstoqueAtacadistaScraper,
        }

        scraper_class = scraper_mapping.get(
            request.supplier_name,
            scraper_mapping.get(request.supplier_name.lower().replace(" ", "_"))
        )

        if not scraper_class:
            raise HTTPException(
                status_code=404,
                detail=f"Fornecedor '{request.supplier_name}' não possui scraper implementado. "
                       f"Fornecedores disponíveis: {', '.join(set(scraper_mapping.keys()))}"
            )

        # Buscar credenciais
        credentials_manager = get_credentials_manager()
        username = request.username
        password = request.password

        if not username or not password:
            logger.info(f"Buscando credenciais do sistema para {request.supplier_name}")
            creds = credentials_manager.get_credentials(
                request.supplier_id,
                request.supplier_name
            )
            if creds:
                username = creds.get("username")
                password = creds.get("password")
                logger.info(f"Credenciais encontradas para {request.supplier_name}")
            else:
                logger.warning(f"Nenhuma credencial encontrada para {request.supplier_name}")

        if username and password:
            if not credentials_manager.validate_credentials(username, password):
                raise HTTPException(
                    status_code=400,
                    detail="Credenciais inválidas (usuário ou senha muito curtos)"
                )

        # ── Verificar cache PostgreSQL ──
        scraper_key = scraper_class.__name__.lower().replace("scraper", "").strip("_")
        estimated = await get_estimated_wait_db(scraper_key)

        if not request.force_refresh:
            cached_data = await db_cache_get(scraper_key, normalized_query, ttl_seconds=CACHE_TTL)
            if cached_data is not None:
                offers = [ProductOffer(**item) for item in cached_data]
                return ProductSearchBySupplierResponse(
                    product_name=request.product_name,
                    supplier_id=request.supplier_id,
                    supplier_name=request.supplier_name,
                    total_results=len(offers),
                    results=offers,
                    search_duration_ms=0,
                    cached=True,
                    estimated_wait_seconds=estimated,
                )

        # ── Cache miss / force refresh — executar scraping ──
        if request.force_refresh:
            logger.info(f"🔄 Force refresh solicitado — ignorando cache de {scraper_key}:{normalized_query}")
        if estimated:
            logger.info(f"⏱️  Estimativa de espera para {scraper_key}: ~{estimated}s")

        t0 = time.time()
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            raw = await loop.run_in_executor(
                executor,
                scrape_store,
                scraper_class,
                normalized_query,
                {"username": username, "password": password} if username and password else None
            )

        offers, duration, _ = raw if isinstance(raw, tuple) else (raw, 0.0, scraper_key)
        duration_ms = int((time.time() - t0) * 1000)

        # Salvar no cache PostgreSQL + registrar tempo
        if isinstance(offers, list) and offers:
            await db_cache_set(scraper_key, normalized_query, [o.model_dump() for o in offers])
            await record_scrape_time_db(scraper_key, duration, normalized_query)

        logger.info(f"Busca concluída: {len(offers)} produtos em {request.supplier_name} ({duration_ms}ms)")

        return ProductSearchBySupplierResponse(
            product_name=request.product_name,
            supplier_id=request.supplier_id,
            supplier_name=request.supplier_name,
            total_results=len(offers),
            results=offers,
            search_duration_ms=duration_ms,
            cached=False,
            estimated_wait_seconds=estimated,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na busca por fornecedor: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar busca: {str(e)}"
        )


@router.get("/market-price")
async def market_price_proxy(
    q: str = Query(..., description="Termo de busca"),
    limit: int = Query(default=12, le=24),
):
    """
    Busca preços no Mercado Livre via scraping da página de resultados.
    A API pública do ML agora bloqueia requests server-side (403).
    """
    from bs4 import BeautifulSoup

    search_term = q.replace(" ", "-").lower()
    url = f"https://lista.mercadolivre.com.br/{search_term}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select("li.ui-search-layout__item")
        logger.info(f"ML scrape: {len(cards)} cards found for '{q}'")

        results = []
        for card in cards[:limit]:
            try:
                title_el = card.select_one(".poly-component__title, .ui-search-item__title")
                fraction_el = card.select_one(".andes-money-amount__fraction")
                cents_el = card.select_one(".andes-money-amount__cents")
                link_el = card.select_one("a.poly-component__title, a.ui-search-link")
                img_el = card.select_one("img.poly-component__picture, img.ui-search-result-image__element")

                if not title_el or not fraction_el:
                    continue

                fraction = fraction_el.get_text(strip=True).replace(".", "")
                cents = cents_el.get_text(strip=True) if cents_el else "00"
                price = float(f"{fraction}.{cents}")
                if price <= 0:
                    continue

                title = title_el.get_text(strip=True)
                link = link_el.get("href", "") if link_el else ""
                thumbnail = ""
                if img_el:
                    thumbnail = img_el.get("data-src") or img_el.get("src") or ""

                results.append({
                    "id": f"MLB-{len(results)}",
                    "title": title,
                    "price": price,
                    "thumbnail": thumbnail,
                    "permalink": link,
                    "condition": "new",
                    "available_quantity": 1,
                    "seller": {"nickname": "Mercado Livre"},
                })
            except Exception:
                continue

        return {
            "results": results,
            "paging": {"total": len(cards)},
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Mercado Livre não respondeu a tempo.")
    except Exception as e:
        logger.error(f"ML scrape error: {e}")
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Mercado Livre: {e}")


@router.get("/search/stats")
async def search_stats():
    """
    Retorna estatísticas de tempo médio de scraping por fornecedor.
    Útil para o frontend exibir estimativas de espera antes de buscar.
    """
    estimates = await get_all_estimates_db()

    # Calcular tempo total estimado (máximo entre scrapers, pois rodam em paralelo)
    total_estimated = round(max(estimates.values()), 1) if estimates else None

    return {
        "cache_backend": "postgresql",
        "cache_ttl_seconds": CACHE_TTL,
        "scraper_avg_seconds": estimates,
        "total_estimated_seconds": total_estimated,
        "hint": "Sem histórico ainda — as primeiras buscas calibram a estimativa" if not estimates else None,
    }


@router.delete("/search/cache")
async def clear_search_cache():
    """Limpa todo o cache de buscas no PostgreSQL."""
    count = await db_cache_clear()
    return {"status": "cache_cleared", "entries_removed": count}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "ConstruPrice API", "database": "postgresql"}
