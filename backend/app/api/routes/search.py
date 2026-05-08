import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import Dict, List, Type

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.database import async_session
from app.models.db_models import ProductDB
from app.models.product import (
    ProductOffer,
    ProductSearchBySupplierRequest,
    ProductSearchBySupplierResponse,
    SearchItemResult,
    SearchRequest,
    SearchResponse,
)
from app.scrapers.base_scraper import BaseScraper
from app.scrapers.cofema_scraper import CofemaScraper
from app.scrapers.estoque_atacadista_scraper import EstoqueAtacadistaScraper
from app.scrapers.megaleste_scraper import MegalesteScraper
from app.scrapers.superabc_scraper import SuperABCScraper
from app.services.cache import (
    db_cache_clear,
    db_cache_get,
    get_all_estimates_db,
    get_estimated_wait_db,
)
from app.services.credentials_manager import get_credentials_manager
from app.services.scraper_manager import get_scraper_manager
from app.services.synonyms import expand_query_for_scrape
from app.utils.text_normalizer import (
    calculate_similarity,
    filter_results_by_query,
    normalize_text,
)

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
                all_variants = [
                    v.strip().lower() for v in (product.variants or []) if v.strip()
                ]
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


async def search_all_stores(
    query: str,
    force_refresh: bool = False,
    allowed_store_names: List[str] | None = None,
) -> List[ProductOffer]:
    """
    Busca em todas as lojas em paralelo com:
    - Cache PostgreSQL com TTL
    - Circuit breaker para lojas problemáticas
    - Timeout rigoroso de 10s por loja
    - Execução paralela com ScraperManager
    """
    from app.api.routes.suppliers import get_all_suppliers_from_db
    from app.services.catalog_scraper import store_scraped_results

    keyword_mapping = {
        "megaleste": MegalesteScraper,
        "cofema": CofemaScraper,
        "atacadista": EstoqueAtacadistaScraper,
        "super abc": SuperABCScraper,
        "superabc": SuperABCScraper,
    }

    def resolve_scraper(name: str):
        normalized = name.lower().strip()
        for keyword, cls in keyword_mapping.items():
            if keyword in normalized:
                return cls
        return None

    allowed_normalized = {
        store_name.lower().strip()
        for store_name in (allowed_store_names or [])
        if store_name and store_name.strip()
    }

    logger.info("Buscando fornecedores ativos do banco de dados...")
    all_suppliers = await get_all_suppliers_from_db()
    active_suppliers = [s for s in all_suppliers if s.is_active]

    if allowed_normalized:
        active_suppliers = [
            supplier
            for supplier in active_suppliers
            if supplier.name.lower().strip() in allowed_normalized
        ]
        logger.info(
            f"Filtro de fornecedores aplicado: {[supplier.name for supplier in active_suppliers]}"
        )

    scrapers_with_creds = []
    if not active_suppliers:
        logger.warning("⚠️  Nenhum fornecedor ativo encontrado")
        if not allowed_normalized:
            scrapers_with_creds = [(MegalesteScraper, None, "megaleste")]
    else:
        seen_scrapers = set()
        for supplier in active_suppliers:
            scraper_class = resolve_scraper(supplier.name)
            if not scraper_class or scraper_class in seen_scrapers:
                if not scraper_class:
                    logger.info(f"   ⚠️  {supplier.name}: sem scraper implementado")
                continue

            seen_scrapers.add(scraper_class)
            scraper_key = (
                scraper_class.__name__.lower().replace("scraper", "").strip("_")
            )
            credentials = {
                "url": supplier.url or "",
                "region": supplier.region or "sp",
            }
            if supplier.requires_login and supplier.username and supplier.password:
                credentials["username"] = supplier.username
                credentials["password"] = supplier.password
            scrapers_with_creds.append((scraper_class, credentials, scraper_key))

        logger.info(f"✅ {len(scrapers_with_creds)} scrapers resolvidos")

    if not scrapers_with_creds:
        logger.info("Nenhum scraper selecionado para a busca atual")
        return []

    # Usar ScraperManager para execução paralela com timeout, cache e circuit breaker
    manager = get_scraper_manager()
    offers = await manager.scrape_all_stores_parallel(
        scrapers_with_creds, query, force_refresh=force_refresh
    )

    # Salvar no catálogo local
    if offers:
        store_offers_by_key = {}
        for offer in offers:
            key = offer.store
            if key not in store_offers_by_key:
                store_offers_by_key[key] = []
            store_offers_by_key[key].append(offer)

        for store_key, store_offers_list in store_offers_by_key.items():
            await store_scraped_results(store_offers_list, store_key, query)

    logger.info(f"Total de ofertas encontradas: {len(offers)}")
    return offers


@router.post("/search", response_model=SearchResponse)
async def search_products(request: SearchRequest):
    return await _search_products_inner(request)


@router.post("/search/stream")
async def search_stream(request: SearchRequest):
    """
    Streaming SSE: envia resultados por fornecedor assim que cada um termina.
    Usa ScraperManager para execução com timeout 10s, cache e circuit breaker.
    """

    async def generate():
        from app.api.routes.suppliers import get_all_suppliers_from_db
        from app.services.catalog_scraper import store_scraped_results

        keyword_mapping = {
            "megaleste": MegalesteScraper,
            "cofema": CofemaScraper,
            "atacadista": EstoqueAtacadistaScraper,
            "super abc": SuperABCScraper,
            "superabc": SuperABCScraper,
        }

        allowed_store_names = [
            store.store_name
            for store in (request.stores or [])
            if store.is_active and store.store_name.strip()
        ]
        allowed_normalized = {
            store_name.lower().strip() for store_name in allowed_store_names
        }

        all_suppliers = await get_all_suppliers_from_db()
        active_suppliers = [s for s in all_suppliers if s.is_active]
        if allowed_normalized:
            active_suppliers = [
                supplier
                for supplier in active_suppliers
                if supplier.name.lower().strip() in allowed_normalized
            ]

        scrapers = []

        if not active_suppliers:
            if not allowed_normalized:
                scrapers = [(MegalesteScraper, None, "Megaleste", "megaleste")]
        else:
            seen = set()
            for supplier in active_suppliers:
                normalized = supplier.name.lower().strip()
                scraper_class = next(
                    (cls for kw, cls in keyword_mapping.items() if kw in normalized),
                    None,
                )
                if not scraper_class or scraper_class in seen:
                    continue
                seen.add(scraper_class)
                scraper_key = (
                    scraper_class.__name__.lower().replace("scraper", "").strip("_")
                )
                creds = {"url": supplier.url or "", "region": supplier.region or "sp"}
                if supplier.requires_login and supplier.username and supplier.password:
                    creds["username"] = supplier.username
                    creds["password"] = supplier.password
                scrapers.append((scraper_class, creds, supplier.name, scraper_key))

        # Expandir sinônimos uma vez
        all_queries: list[str] = []
        for item in request.items:
            normalized = normalize_text(item)
            db_terms = await get_db_variants(normalized)
            terms = db_terms if len(db_terms) > 1 else expand_query_for_scrape(item)
            all_queries.extend(terms)

        manager = get_scraper_manager()
        all_store_names = [s[2] for s in scrapers]

        # Emite evento inicial informando quais lojas serão buscadas
        yield f"data: {json.dumps({'event': 'start', 'pending_stores': all_store_names, 'done': False})}\n\n"

        completed: list[str] = []

        for scraper_class, credentials, store_name, scraper_key in scrapers:
            t0 = time.time()
            status = "done"
            store_error_msg = None
            try:
                store_offers: list[ProductOffer] = []
                seen_keys: set[str] = set()

                for sq in all_queries:
                    sq_norm = normalize_text(sq)

                    # Usar manager para scraping com timeout, cache e circuit breaker
                    offers, duration, _, error_msg = await manager.scrape_store_async(
                        scraper_class,
                        sq_norm,
                        scraper_key,
                        credentials,
                        force_refresh=request.force_refresh,
                    )

                    if error_msg:
                        store_error_msg = error_msg
                        logger.error(f"Stream [{store_name}]: {error_msg}")
                        status = (
                            "login_error" if "login" in error_msg.lower() else "error"
                        )
                        break  # Erro — não adianta tentar outros termos

                    if offers:
                        await store_scraped_results(offers, scraper_key, sq_norm)

                    # Filter by THIS synonym before pooling — prevents cross-contamination.
                    # e.g. "adesivo tigre" results are judged against "adesivo tigre",
                    # not the original "cola tigre", so relevant synonymous products are kept.
                    relevant = filter_results_by_query(sq, offers)
                    for offer in relevant:
                        key = f"{offer.store}:{offer.sku or offer.product_name[:30].lower()}"
                        if key not in seen_keys:
                            seen_keys.add(key)
                            store_offers.append(offer)

                if not store_error_msg:
                    status = "done"

                completed.append(store_name)
                for o in store_offers:
                    o.score = max(
                        calculate_similarity(it, o.product_name)
                        for it in request.items
                    )
                store_offers.sort(
                    key=lambda x: (-x.score, x.price if x.price > 0 else float("inf"))
                )
                payload = json.dumps(
                    {
                        "event": "store_done",
                        "store": store_name,
                        "status": status,
                        "duration_ms": int((time.time() - t0) * 1000),
                        "offers": [o.model_dump() for o in store_offers],
                        "pending_stores": [
                            s for s in all_store_names if s not in completed
                        ],
                        "done": False,
                        **({"error": store_error_msg} if store_error_msg else {}),
                    }
                )
                yield f"data: {payload}\n\n"

            except Exception as e:
                logger.error(f"Stream error [{store_name}]: {e}")
                completed.append(store_name)
                yield f"data: {json.dumps({'event': 'store_done', 'store': store_name, 'status': 'error', 'offers': [], 'pending_stores': [s for s in all_store_names if s not in completed], 'done': False, 'error': str(e)})}\n\n"

        yield f"data: {json.dumps({'event': 'end', 'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _search_products_inner(request: SearchRequest) -> SearchResponse:
    try:
        t_total = time.time()
        results = []

        allowed_store_names = [
            store.store_name
            for store in (request.stores or [])
            if store.is_active and store.store_name.strip()
        ]

        for item in request.items:
            normalized_query = normalize_text(item)
            logger.info(f"Buscando: {item} (normalizado: {normalized_query})")

            t_item = time.time()

            # Expandir query: primeiro variantes do DB, fallback para sinônimos estáticos
            db_terms = await get_db_variants(normalized_query)
            if len(db_terms) > 1:
                synonym_queries = db_terms
                logger.info(
                    f"Variantes do DB para '{normalized_query}': {synonym_queries}"
                )
            else:
                synonym_queries = expand_query_for_scrape(item)
                logger.info(
                    f"Termos de scraping para '{normalized_query}': {synonym_queries}"
                )

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

            # Buscar termo principal e filtrar por ele antes de adicionar ao pool
            main_offers = await search_all_stores(
                normalized_query,
                force_refresh=request.force_refresh,
                allowed_store_names=allowed_store_names,
            )
            _merge([filter_results_by_query(normalized_query, main_offers)])

            # Sinônimos extras: cada um filtrado pelo seu próprio termo antes de unir
            # Isso evita que resultados de "adesivo tigre" sejam filtrados por "cola tigre"
            extra_queries = [
                sq for sq in synonym_queries if normalize_text(sq) != normalized_query
            ]
            if extra_queries:
                tasks = [
                    search_all_stores(
                        normalize_text(sq),
                        force_refresh=request.force_refresh,
                        allowed_store_names=allowed_store_names,
                    )
                    for sq in extra_queries
                ]
                extra_results = await asyncio.gather(*tasks, return_exceptions=True)
                for sq, sq_result in zip(extra_queries, extra_results):
                    if isinstance(sq_result, Exception):
                        continue
                    _merge([filter_results_by_query(sq, sq_result)])

            offers = all_offers
            offers.sort(
                key=lambda x: (-getattr(x, "score", 0), x.price if x.price > 0 else float("inf"))
            )
            item_ms = int((time.time() - t_item) * 1000)

            # Marcar melhor preço
            prices_with_value = [offer.price for offer in offers if offer.price > 0]
            if offers and prices_with_value:
                min_price = min(prices_with_value)
                for offer in offers:
                    if offer.price == min_price:
                        offer.product_name = f"✓ {offer.product_name}"

            results.append(
                SearchItemResult(
                    raw_query=item,
                    normalized_query=normalized_query,
                    offers=offers,
                    search_duration_ms=item_ms,
                )
            )

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
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar busca: {str(e)}"
        )


@router.post("/search-by-supplier", response_model=ProductSearchBySupplierResponse)
async def search_by_supplier(request: ProductSearchBySupplierRequest):
    """
    Endpoint para buscar produtos por nome em um fornecedor específico.
    Usa ScraperManager para execução com timeout 10s, cache e circuit breaker.
    """
    try:
        if not request.product_name or len(request.product_name.strip()) < 2:
            raise HTTPException(
                status_code=400,
                detail="Nome do produto deve ter pelo menos 2 caracteres",
            )

        normalized_query = normalize_text(request.product_name)
        logger.info(
            f"Buscando '{request.product_name}' em {request.supplier_name} (ID: {request.supplier_id})"
        )

        scraper_mapping: Dict[str, Type[BaseScraper]] = {
            "Estoque Megaleste": MegalesteScraper,
            "megaleste": MegalesteScraper,
            "Cofema Materiais": CofemaScraper,
            "cofema": CofemaScraper,
            "Estoque Atacadista": EstoqueAtacadistaScraper,
            "estoque_atacadista": EstoqueAtacadistaScraper,
            "Super ABC Distribuidora": SuperABCScraper,
            "superabc": SuperABCScraper,
        }

        scraper_class = scraper_mapping.get(
            request.supplier_name,
            scraper_mapping.get(request.supplier_name.lower().replace(" ", "_")),
        )

        if not scraper_class:
            raise HTTPException(
                status_code=404,
                detail=f"Fornecedor '{request.supplier_name}' não possui scraper implementado. "
                f"Fornecedores disponíveis: {', '.join(set(scraper_mapping.keys()))}",
            )

        # Buscar credenciais
        credentials_manager = get_credentials_manager()
        username = request.username
        password = request.password

        if not username or not password:
            logger.info(f"Buscando credenciais do sistema para {request.supplier_name}")
            creds = credentials_manager.get_credentials(
                request.supplier_id, request.supplier_name
            )
            if creds:
                username = creds.get("username")
                password = creds.get("password")
                logger.info(f"Credenciais encontradas para {request.supplier_name}")
            else:
                logger.warning(
                    f"Nenhuma credencial encontrada para {request.supplier_name}"
                )

        if username and password:
            if not credentials_manager.validate_credentials(username, password):
                raise HTTPException(
                    status_code=400,
                    detail="Credenciais inválidas (usuário ou senha muito curtos)",
                )

        # ── Executar com ScraperManager (trata cache, timeout, circuit breaker) ──
        scraper_key = scraper_class.__name__.lower().replace("scraper", "").strip("_")
        estimated = await get_estimated_wait_db(scraper_key)

        if not request.force_refresh:
            cached_data = await db_cache_get(
                scraper_key, normalized_query, ttl_seconds=CACHE_TTL
            )
            if cached_data is not None:
                offers = [ProductOffer(**item) for item in cached_data]
                ranked = filter_results_by_query(request.product_name, offers)
                ranked.sort(
                    key=lambda x: (-x.score, x.price if x.price > 0 else float("inf"))
                )
                return ProductSearchBySupplierResponse(
                    product_name=request.product_name,
                    supplier_id=request.supplier_id,
                    supplier_name=request.supplier_name,
                    total_results=len(ranked),
                    results=ranked,
                    search_duration_ms=0,
                    cached=True,
                    estimated_wait_seconds=estimated,
                )

        if request.force_refresh:
            logger.info(
                f"🔄 Force refresh solicitado — ignorando cache de {scraper_key}:{normalized_query}"
            )

        t0 = time.time()
        manager = get_scraper_manager()
        credentials = None
        if username and password:
            credentials = {"username": username, "password": password}

        from app.services.catalog_scraper import store_scraped_results

        scrape_queries = expand_query_for_scrape(request.product_name)
        offers: List[ProductOffer] = []
        seen_offer: set[str] = set()
        last_error: str | None = None
        for sq in scrape_queries:
            sub_norm = normalize_text(sq)
            part, duration, _, error_msg = await manager.scrape_store_async(
                scraper_class,
                sub_norm,
                scraper_key,
                credentials,
                force_refresh=request.force_refresh,
            )
            if error_msg:
                last_error = error_msg
                logger.warning(
                    "Busca por fornecedor (%r) falhou — tentando próximo termo: %s",
                    sq,
                    error_msg,
                )
                continue
            if part:
                await store_scraped_results(part, scraper_key, sub_norm)
                for o in part:
                    key = f"{o.store}:{o.sku or o.product_name[:40].lower()}"
                    if key not in seen_offer:
                        seen_offer.add(key)
                        offers.append(o)
        duration_ms = int((time.time() - t0) * 1000)

        if last_error and not offers:
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao buscar em {request.supplier_name}: {last_error}",
            )

        logger.info(
            f"Busca concluída: {len(offers)} produtos em {request.supplier_name} ({duration_ms}ms)"
        )

        ranked = filter_results_by_query(request.product_name, offers)
        ranked.sort(
            key=lambda x: (-x.score, x.price if x.price > 0 else float("inf"))
        )

        return ProductSearchBySupplierResponse(
            product_name=request.product_name,
            supplier_id=request.supplier_id,
            supplier_name=request.supplier_name,
            total_results=len(ranked),
            results=ranked,
            search_duration_ms=duration_ms,
            cached=False,
            estimated_wait_seconds=estimated,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na busca por fornecedor: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar busca: {str(e)}"
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
                title_el = card.select_one(
                    ".poly-component__title, .ui-search-item__title"
                )
                fraction_el = card.select_one(".andes-money-amount__fraction")
                cents_el = card.select_one(".andes-money-amount__cents")
                link_el = card.select_one("a.poly-component__title, a.ui-search-link")
                img_el = card.select_one(
                    "img.poly-component__picture, img.ui-search-result-image__element"
                )

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

                results.append(
                    {
                        "id": f"MLB-{len(results)}",
                        "title": title,
                        "price": price,
                        "thumbnail": thumbnail,
                        "permalink": link,
                        "condition": "new",
                        "available_quantity": 1,
                        "seller": {"nickname": "Mercado Livre"},
                    }
                )
            except Exception:
                continue

        return {
            "results": results,
            "paging": {"total": len(cards)},
        }

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504, detail="Mercado Livre não respondeu a tempo."
        )
    except Exception as e:
        logger.error(f"ML scrape error: {e}")
        raise HTTPException(
            status_code=502, detail=f"Erro ao consultar Mercado Livre: {e}"
        )


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
        "hint": "Sem histórico ainda — as primeiras buscas calibram a estimativa"
        if not estimates
        else None,
    }


@router.delete("/search/cache")
async def clear_search_cache():
    """Limpa todo o cache de buscas no PostgreSQL."""
    count = await db_cache_clear()
    return {"status": "cache_cleared", "entries_removed": count}


@router.get("/search/suggestions")
async def get_search_suggestions(
    q: str = Query(default="", description="Termo de busca"),
    limit: int = Query(default=8, ge=1, le=20),
):
    """
    Autocomplete para a busca avançada.
    Retorna produtos do catálogo que correspondem ao termo e sinônimos conhecidos.
    """
    term = (q or "").strip()
    if len(term) < 2:
        return {"products": [], "synonyms": [], "has_match": False}

    normalized = normalize_text(term)
    matches: list[dict] = []
    seen: set[str] = set()

    try:
        async with async_session() as session:
            result = await session.execute(select(ProductDB))
            for product in result.scalars().all():
                name_n = normalize_text(product.name)
                brand_n = normalize_text(product.brand or "")
                cat_n = normalize_text(product.category or "")
                variants_n = [normalize_text(v) for v in (product.variants or [])]

                score = 0
                if name_n.startswith(normalized):
                    score = 100
                elif normalized in name_n:
                    score = 85
                elif any(normalized in v for v in variants_n):
                    score = 75
                elif normalized in brand_n:
                    score = 60
                elif normalized in cat_n:
                    score = 40

                if score > 0 and product.name not in seen:
                    seen.add(product.name)
                    matches.append({
                        "name": product.name,
                        "brand": product.brand or "",
                        "category": product.category or "",
                        "score": score,
                    })
    except Exception as e:
        logger.warning(f"Erro ao buscar sugestões: {e}")

    matches.sort(key=lambda x: -x["score"])

    synonym_terms = expand_query_for_scrape(term, max_variants=6)
    # Remove o próprio termo e o normalizado da lista de sinônimos
    synonym_terms = [s for s in synonym_terms if normalize_text(s) != normalized]

    return {
        "products": [{"name": m["name"], "brand": m["brand"], "category": m["category"]} for m in matches[:limit]],
        "synonyms": synonym_terms[:5],
        "has_match": len(matches) > 0,
    }


@router.post("/search/instant", response_model=SearchResponse)
async def search_instant(request: SearchRequest):
    """
    Busca instantânea no catálogo local (pré-scraped).
    Retorna em <100ms usando dados do PostgreSQL.
    Se não houver dados pré-scraped, faz fallback para busca normal.
    """
    from sqlalchemy import func, or_

    from app.models.db_models import CatalogScrapeStatusDB, ScrapedProductDB

    t0 = time.time()
    results = []
    has_catalog_data = False
    allowed_store_names = [
        store.store_name
        for store in (request.stores or [])
        if store.is_active and store.store_name.strip()
    ]
    allowed_normalized = {
        store_name.lower().strip() for store_name in allowed_store_names
    }

    try:
        async with async_session() as session:
            count = await session.execute(
                select(func.count()).select_from(ScrapedProductDB)
            )
            has_catalog_data = (count.scalar() or 0) > 0

        if not has_catalog_data:
            logger.info("No catalog data — falling back to live search")
            return await _search_products_inner(request)

        for item in request.items:
            normalized = normalize_text(item)
            tokens = normalized.split()

            async with async_session() as session:
                query = select(ScrapedProductDB)
                token_conds = [
                    ScrapedProductDB.product_name_normalized.ilike(f"%{t}%")
                    for t in tokens
                    if len(t) >= 2
                ]
                if not token_conds:
                    rows = []
                else:
                    # OR: traz "Adesivo Tigre" mesmo sem a palavra "cola" no nome normalizado
                    query = query.where(or_(*token_conds))

                    if allowed_normalized:
                        query = query.where(
                            ScrapedProductDB.store.in_(allowed_store_names)
                        )

                    query = query.limit(1200)
                    result = await session.execute(query)
                    rows = result.scalars().all()

            offers = []
            seen = set()
            for row in rows:
                key = f"{row.store}:{row.sku or row.product_name[:30].lower()}"
                if key in seen:
                    continue
                seen.add(key)
                offers.append(
                    ProductOffer(
                        store=row.store,
                        product_name=row.product_name,
                        price=row.price,
                        currency=row.currency,
                        product_url=row.product_url,
                        add_to_cart_url=row.add_to_cart_url,
                        availability=row.availability,
                        sku=row.sku,
                        image_url=row.image_url,
                        description=row.description,
                        brand=row.brand,
                        score=row.score,
                    )
                )

            offers = filter_results_by_query(item, offers)
            offers.sort(
                key=lambda x: (-x.score, x.price if x.price > 0 else float("inf"))
            )

            prices_with_value = [o.price for o in offers if o.price > 0]
            if offers and prices_with_value:
                min_price = min(prices_with_value)
                for o in offers:
                    if o.price == min_price:
                        o.product_name = f"✓ {o.product_name}"

            results.append(
                SearchItemResult(
                    raw_query=item,
                    normalized_query=normalized,
                    offers=offers,
                    search_duration_ms=int((time.time() - t0) * 1000),
                    cached=True,
                )
            )

        all_stores = set()
        for r in results:
            for o in r.offers:
                all_stores.add(o.store)

        # Get catalog freshness info
        catalog_age_minutes = None
        async with async_session() as session:
            from sqlalchemy import desc

            stmt = (
                select(ScrapedProductDB.scraped_at)
                .order_by(desc(ScrapedProductDB.scraped_at))
                .limit(1)
            )
            result = await session.execute(stmt)
            latest = result.scalar()
            if latest:
                from datetime import timezone as tz

                age = datetime.now(tz.utc) - latest.replace(tzinfo=tz.utc)
                catalog_age_minutes = int(age.total_seconds() / 60)

        return SearchResponse(
            items=results,
            total_items=len(results),
            stores=sorted(list(all_stores)),
            total_duration_ms=int((time.time() - t0) * 1000),
            estimated_wait_seconds={"catalog_age_minutes": catalog_age_minutes}
            if catalog_age_minutes is not None
            else None,
        )

    except Exception as e:
        logger.error(f"Instant search error: {e}", exc_info=True)
        return await _search_products_inner(request)


@router.post("/search/refresh")
async def search_refresh(request: SearchRequest):
    """
    Atualiza preços sob demanda: re-scrapa os produtos solicitados
    e retorna resultados frescos. Atualiza o catálogo local também.
    """
    from app.services.catalog_scraper import refresh_products

    t0 = time.time()
    fresh_offers = await refresh_products(request.items)
    allowed_store_names = [
        store.store_name
        for store in (request.stores or [])
        if store.is_active and store.store_name.strip()
    ]
    allowed_normalized = {
        store_name.lower().strip() for store_name in allowed_store_names
    }

    results = []
    for item in request.items:
        normalized = normalize_text(item)
        item_offers = filter_results_by_query(item, fresh_offers)
        item_offers.sort(
            key=lambda x: (-x.score, x.price if x.price > 0 else float("inf"))
        )

        if allowed_normalized:
            item_offers = [
                offer
                for offer in item_offers
                if offer.store.lower().strip() in allowed_normalized
            ]

        prices_with_value = [o.price for o in item_offers if o.price > 0]
        if item_offers and prices_with_value:
            min_price = min(prices_with_value)
            for o in item_offers:
                if o.price == min_price:
                    o.product_name = f"✓ {o.product_name}"

        results.append(
            SearchItemResult(
                raw_query=item,
                normalized_query=normalized,
                offers=item_offers,
                search_duration_ms=int((time.time() - t0) * 1000),
                cached=False,
            )
        )

    all_stores = set()
    for r in results:
        for o in r.offers:
            all_stores.add(o.store)

    return SearchResponse(
        items=results,
        total_items=len(results),
        stores=sorted(list(all_stores)),
        total_duration_ms=int((time.time() - t0) * 1000),
    )


@router.get("/search/catalog-status")
async def catalog_status():
    """
    Retorna status do catálogo pré-scraped:
    - Quantos produtos estão no catálogo local
    - Quando foi a última atualização por loja
    - Se o scraping está rodando agora
    """
    from datetime import timezone as tz

    from sqlalchemy import desc, func

    from app.models.db_models import CatalogScrapeStatusDB, ScrapedProductDB
    from app.services.catalog_scraper import is_running

    try:
        async with async_session() as session:
            total = await session.execute(
                select(func.count()).select_from(ScrapedProductDB)
            )
            total_products = total.scalar() or 0

            stores_stmt = select(
                ScrapedProductDB.store,
                func.count().label("count"),
                func.max(ScrapedProductDB.scraped_at).label("last_scraped"),
            ).group_by(ScrapedProductDB.store)
            stores_result = await session.execute(stores_stmt)
            stores = {}
            oldest_scrape = None
            for row in stores_result.all():
                scraped_at = row.last_scraped
                if scraped_at:
                    scraped_at_utc = (
                        scraped_at.replace(tzinfo=tz.utc)
                        if scraped_at.tzinfo is None
                        else scraped_at
                    )
                    age_minutes = int(
                        (datetime.now(tz.utc) - scraped_at_utc).total_seconds() / 60
                    )
                    if oldest_scrape is None or age_minutes > oldest_scrape:
                        oldest_scrape = age_minutes
                else:
                    age_minutes = None

                stores[row.store] = {
                    "product_count": row.count,
                    "last_scraped": scraped_at.isoformat() if scraped_at else None,
                    "age_minutes": age_minutes,
                }

            status_stmt = (
                select(CatalogScrapeStatusDB)
                .order_by(desc(CatalogScrapeStatusDB.started_at))
                .limit(5)
            )
            status_result = await session.execute(status_stmt)
            recent_runs = [
                {
                    "scraper_key": s.scraper_key,
                    "status": s.status,
                    "total_products": s.total_products,
                    "duration_seconds": s.duration_seconds,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "finished_at": s.finished_at.isoformat() if s.finished_at else None,
                    "error": s.error_message,
                }
                for s in status_result.scalars().all()
            ]

        return {
            "total_products": total_products,
            "stores": stores,
            "is_scraping": is_running(),
            "catalog_age_minutes": oldest_scrape,
            "recent_runs": recent_runs,
        }
    except Exception as e:
        logger.error(f"Catalog status error: {e}")
        return {
            "total_products": 0,
            "stores": {},
            "is_scraping": False,
            "error": str(e),
        }


@router.post("/search/trigger-scrape")
async def trigger_catalog_scrape():
    """Dispara manualmente o scraping do catálogo completo."""
    from app.services.catalog_scraper import is_running, run_catalog_scrape

    if is_running():
        return {"status": "already_running", "message": "Scraping já está em execução"}

    asyncio.create_task(run_catalog_scrape())
    return {
        "status": "started",
        "message": "Scraping do catálogo iniciado em background",
    }


@router.get("/search/catalog-facets")
async def catalog_facets():
    """Retorna facetas para filtros dinâmicos do catálogo."""
    from sqlalchemy import func
    from app.models.db_models import ScrapedProductDB

    try:
        async with async_session() as session:
            stores_r = await session.execute(
                select(ScrapedProductDB.store, func.count().label("c"))
                .group_by(ScrapedProductDB.store).order_by(func.count().desc())
            )
            brands_r = await session.execute(
                select(ScrapedProductDB.brand, func.count().label("c"))
                .where(ScrapedProductDB.brand.isnot(None)).where(ScrapedProductDB.brand != "")
                .group_by(ScrapedProductDB.brand).order_by(func.count().desc()).limit(40)
            )
            cats_r = await session.execute(
                select(ScrapedProductDB.source_query, func.count().label("c"))
                .group_by(ScrapedProductDB.source_query).order_by(func.count().desc()).limit(60)
            )
            price_r = await session.execute(
                select(
                    func.min(ScrapedProductDB.price).label("mn"),
                    func.max(ScrapedProductDB.price).label("mx"),
                    func.avg(ScrapedProductDB.price).label("avg"),
                ).where(ScrapedProductDB.price > 0)
            )
            avail_r = await session.execute(
                select(ScrapedProductDB.availability, func.count().label("c"))
                .group_by(ScrapedProductDB.availability)
            )
            pr = price_r.one()
            return {
                "stores": [{"name": r.store, "count": r.c} for r in stores_r.all()],
                "brands": [{"name": r.brand, "count": r.c} for r in brands_r.all()],
                "categories": [{"name": r.source_query, "count": r.c} for r in cats_r.all()],
                "price_min": float(pr.mn or 0),
                "price_max": float(pr.mx or 0),
                "price_avg": float(pr.avg or 0),
                "availability": [{"name": r.availability, "count": r.c} for r in avail_r.all()],
            }
    except Exception as e:
        logger.error(f"Catalog facets error: {e}")
        return {"stores": [], "brands": [], "categories": [], "price_min": 0, "price_max": 0, "price_avg": 0, "availability": []}


@router.get("/search/catalog-items")
async def catalog_items(
    q: str = "",
    stores: str = "",
    availability: str = "",
    brands: str = "",
    categories: str = "",
    min_price: float = 0,
    max_price: float = 0,
    sort_by: str = "newest",
    page: int = 1,
    limit: int = 60,
):
    """Lista produtos do catálogo local com paginação e filtros avançados."""
    from sqlalchemy import func, asc, desc
    from app.models.db_models import ScrapedProductDB

    limit = min(limit, 200)
    offset = (page - 1) * limit

    try:
        async with async_session() as session:
            def build_where(stmt):
                if q:
                    stmt = stmt.where(ScrapedProductDB.product_name_normalized.like(f"%{q.lower()}%"))
                if stores:
                    store_list = [s.strip() for s in stores.split(",") if s.strip()]
                    if store_list:
                        stmt = stmt.where(ScrapedProductDB.store.in_(store_list))
                if availability:
                    avail_list = [a.strip() for a in availability.split(",") if a.strip()]
                    if avail_list:
                        stmt = stmt.where(ScrapedProductDB.availability.in_(avail_list))
                if brands:
                    brand_list = [b.strip() for b in brands.split(",") if b.strip()]
                    if brand_list:
                        stmt = stmt.where(ScrapedProductDB.brand.in_(brand_list))
                if categories:
                    cat_list = [c.strip() for c in categories.split(",") if c.strip()]
                    if cat_list:
                        stmt = stmt.where(ScrapedProductDB.source_query.in_(cat_list))
                if min_price > 0:
                    stmt = stmt.where(ScrapedProductDB.price >= min_price)
                if max_price > 0:
                    stmt = stmt.where(ScrapedProductDB.price <= max_price)
                return stmt

            count_stmt = build_where(select(func.count()).select_from(ScrapedProductDB))
            total = (await session.execute(count_stmt)).scalar() or 0

            stmt = build_where(select(ScrapedProductDB))
            sort_map = {
                "newest": desc(ScrapedProductDB.scraped_at),
                "price_asc": asc(ScrapedProductDB.price),
                "price_desc": desc(ScrapedProductDB.price),
                "name_asc": asc(ScrapedProductDB.product_name),
                "score": desc(ScrapedProductDB.score),
            }
            stmt = stmt.order_by(sort_map.get(sort_by, desc(ScrapedProductDB.scraped_at))).offset(offset).limit(limit)
            items = (await session.execute(stmt)).scalars().all()

            return {
                "items": [{
                    "id": p.id, "store": p.store,
                    "productName": p.product_name, "price": p.price,
                    "currency": p.currency, "productUrl": p.product_url,
                    "addToCartUrl": p.add_to_cart_url,
                    "availability": p.availability, "sku": p.sku,
                    "imageUrl": p.image_url, "description": p.description,
                    "brand": p.brand, "score": p.score,
                    "sourceQuery": p.source_query,
                    "scraperKey": p.scraper_key,
                    "scrapedAt": p.scraped_at.isoformat() if p.scraped_at else None,
                } for p in items],
                "total": total, "page": page, "limit": limit,
                "totalPages": max(1, -(-total // limit)),
            }
    except Exception as e:
        logger.error(f"Catalog items error: {e}")
        return {"items": [], "total": 0, "page": 1, "limit": limit, "totalPages": 1}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "ConstruPrice API", "database": "postgresql"}
