"""
Catalog Scraper — Pre-scrapes all catalog products periodically.

Runs in background, stores results in scraped_products table.
User searches become instant PostgreSQL queries instead of live scraping.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import List

from app.database import async_session
from app.services.scraper_manager import get_scraper_manager
from app.models.db_models import (
    ProductDB, SupplierDB, ScrapedProductDB, CatalogScrapeStatusDB,
)
from app.models.product import ProductOffer
from app.utils.text_normalizer import normalize_text
from sqlalchemy import select

logger = logging.getLogger(__name__)

_running = False


def _get_scraper_mapping():
    from app.scrapers.megaleste_scraper import MegalesteScraper
    from app.scrapers.cofema_scraper import CofemaScraper
    from app.scrapers.estoque_atacadista_scraper import EstoqueAtacadistaScraper
    from app.scrapers.gigavale_scraper import GigavaleScraper
    from app.scrapers.superabc_scraper import SuperABCScraper
    return {
        "megaleste": MegalesteScraper,
        "cofema": CofemaScraper,
        "atacadista": EstoqueAtacadistaScraper,
        "gigavale": GigavaleScraper,
        "super abc": SuperABCScraper,
        "superabc": SuperABCScraper,
    }


async def _get_catalog_queries() -> List[str]:
    """Get all unique product names + variants from the catalog."""
    queries = set()
    async with async_session() as session:
        result = await session.execute(select(ProductDB))
        for product in result.scalars().all():
            queries.add(product.name.strip())
            for v in (product.variants or []):
                if v.strip():
                    queries.add(v.strip())
    return sorted(queries)


async def _get_active_scrapers():
    """Resolve active suppliers to scraper classes with credentials."""
    from app.api.routes.suppliers import get_all_suppliers_from_db
    keyword_mapping = _get_scraper_mapping()

    suppliers = await get_all_suppliers_from_db()
    active = [s for s in suppliers if s.is_active]

    scrapers = []
    seen = set()
    for supplier in active:
        normalized = supplier.name.lower().strip()
        scraper_class = next(
            (cls for kw, cls in keyword_mapping.items() if kw in normalized),
            None,
        )
        if not scraper_class or scraper_class in seen:
            continue
        seen.add(scraper_class)
        credentials = {"url": supplier.url or "", "region": supplier.region or "sp"}
        if supplier.requires_login and supplier.username and supplier.password:
            credentials["username"] = supplier.username
            credentials["password"] = supplier.password
        scrapers.append((scraper_class, credentials, supplier.name))

    return scrapers


def _scraper_key_for(scraper_class) -> str:
    """Chave curta do scraper (mesma convenção usada em search.py e no manager)."""
    return scraper_class.__name__.lower().replace("scraper", "").strip("_")


def _is_deadlock_error(exc: Exception) -> bool:
    """Detecta deadlock/serialization do PostgreSQL (asyncpg) dentro do wrapper SQLAlchemy."""
    orig = getattr(exc, "orig", exc)
    name = type(orig).__name__
    if name in ("DeadlockDetectedError", "SerializationError"):
        return True
    return "deadlock detected" in str(orig).lower()


def _dedup_key(scraper_key: str, sku: str, name_norm: str) -> str:
    """
    Chave determinística para deduplicação. Precisa casar EXATAMENTE com o
    backfill SQL em database.py (create_tables). SKU é a identidade autoritativa
    quando presente; senão usa o nome normalizado.
    """
    if sku:
        return f"{scraper_key}|sku|{sku}"
    return f"{scraper_key}|name|{name_norm}"


async def store_scraped_results(
    offers: List[ProductOffer],
    scraper_key: str,
    source_query: str,
    max_retries: int = 4,
):
    """
    Upsert atômico dos produtos scraped no catálogo local via
    INSERT ... ON CONFLICT (dedup_key) DO UPDATE.

    Diferente do SELECT-depois-UPDATE anterior (que causava deadlock quando o
    scrape agendado e as buscas ao vivo escreviam ao mesmo tempo), o upsert
    adquire o lock da linha de forma atômica. Ainda assim: (1) os offers são
    deduplicados e ordenados por dedup_key para que transações concorrentes
    travem na mesma ordem, e (2) há retry com backoff como rede de segurança.
    """
    if not offers:
        return 0

    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.exc import DBAPIError

    now = datetime.now(timezone.utc)

    # Monta as linhas deduplicando por dedup_key dentro do próprio lote
    # (ON CONFLICT não pode afetar a mesma linha duas vezes no mesmo INSERT).
    rows_by_key = {}
    for offer in offers:
        name_norm = normalize_text(offer.product_name)
        sku_val = offer.sku or ""
        key = _dedup_key(scraper_key, sku_val, name_norm)
        rows_by_key[key] = {
            "dedup_key": key,
            "store": offer.store,
            "product_name": offer.product_name,
            "product_name_normalized": name_norm,
            "price": offer.price,
            "currency": offer.currency,
            "product_url": offer.product_url,
            "add_to_cart_url": offer.add_to_cart_url,
            "availability": offer.availability,
            "sku": sku_val or None,
            "image_url": offer.image_url,
            "description": offer.description,
            "brand": offer.brand,
            "score": offer.score,
            "source_query": source_query,
            "scraper_key": scraper_key,
            "scraped_at": now,
        }

    # Ordem determinística + chunking (limite de parâmetros do asyncpg)
    rows = [rows_by_key[k] for k in sorted(rows_by_key)]
    CHUNK = 200

    for attempt in range(max_retries):
        try:
            async with async_session() as session:
                for i in range(0, len(rows), CHUNK):
                    chunk = rows[i:i + CHUNK]
                    stmt = pg_insert(ScrapedProductDB).values(chunk)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["dedup_key"],
                        set_={
                            "price": stmt.excluded.price,
                            "availability": stmt.excluded.availability,
                            "product_url": stmt.excluded.product_url,
                            "add_to_cart_url": stmt.excluded.add_to_cart_url,
                            "image_url": stmt.excluded.image_url,
                            "description": stmt.excluded.description,
                            "brand": stmt.excluded.brand,
                            "score": stmt.excluded.score,
                            "source_query": stmt.excluded.source_query,
                            "product_name": stmt.excluded.product_name,
                            "product_name_normalized": stmt.excluded.product_name_normalized,
                            "scraped_at": stmt.excluded.scraped_at,
                        },
                    )
                    await session.execute(stmt)
                await session.commit()

            return len(rows)

        except DBAPIError as e:
            if _is_deadlock_error(e) and attempt < max_retries - 1:
                wait = 0.25 * (2 ** attempt)
                logger.warning(
                    f"Deadlock em store_scraped_results [{scraper_key}] — "
                    f"retry {attempt + 1}/{max_retries} em {wait:.2f}s"
                )
                await asyncio.sleep(wait)
                continue
            raise

    return 0


async def _update_status(scraper_key: str, **kwargs):
    """Create or update scrape status record."""
    async with async_session() as session:
        status = CatalogScrapeStatusDB(scraper_key=scraper_key, **kwargs)
        session.add(status)
        await session.commit()


async def run_catalog_scrape(specific_queries: List[str] = None):
    """
    Main entry point: scrape all catalog products across all active stores.
    If specific_queries is provided, only scrape those terms.
    """
    global _running
    if _running:
        logger.warning("Catalog scrape already running — skipping")
        return
    _running = True

    try:
        queries = specific_queries or await _get_catalog_queries()
        if not queries:
            logger.info("No catalog products to scrape")
            return

        scrapers = await _get_active_scrapers()
        if not scrapers:
            logger.warning("No active scrapers found")
            return

        logger.info(
            f"Starting catalog scrape: {len(queries)} queries x {len(scrapers)} stores"
        )

        manager = get_scraper_manager()

        for scraper_class, credentials, store_name in scrapers:
            scraper_key = _scraper_key_for(scraper_class)
            t0 = time.time()
            total_products = 0
            last_error = None

            await _update_status(
                scraper_key,
                status="running",
                total_queries=len(queries),
                started_at=datetime.now(timezone.utc),
            )

            for query in queries:
                try:
                    normalized = normalize_text(query)
                    # Via ScraperManager: ganha timeout, cache e circuit breaker.
                    offers, duration, _, error_msg = await manager.scrape_store_async(
                        scraper_class, normalized, scraper_key, credentials,
                    )
                    if error_msg:
                        last_error = error_msg
                        logger.warning(
                            f"Catalog scrape [{store_name}] '{query}': {error_msg}"
                        )
                        # Erros de login/credencial afetam TODAS as queries desta
                        # loja — aborta cedo. Erros transitórios seguem para a
                        # próxima query (o circuit breaker do manager evita loop).
                        if "login" in error_msg.lower() or "credenc" in error_msg.lower():
                            break
                        continue
                    if offers:
                        await store_scraped_results(offers, scraper_key, normalized)
                        total_products += len(offers)
                except Exception as e:
                    last_error = str(e)
                    logger.error(f"Catalog scrape error [{store_name}] '{query}': {e}")
                    continue
                finally:
                    await asyncio.sleep(0.5)

            duration = time.time() - t0
            await _update_status(
                scraper_key,
                status="done" if total_products or not last_error else "error",
                total_products=total_products,
                total_queries=len(queries),
                duration_seconds=duration,
                error_message=last_error,
                finished_at=datetime.now(timezone.utc),
            )
            logger.info(
                f"Catalog scrape [{store_name}] done: "
                f"{total_products} products in {duration:.1f}s"
            )

    except Exception as e:
        logger.error(f"Catalog scrape failed: {e}", exc_info=True)
    finally:
        _running = False


async def refresh_products(queries: List[str]):
    """
    On-demand refresh: re-scrape specific products across all stores.
    Returns fresh results immediately.
    """
    results = []
    scrapers = await _get_active_scrapers()
    manager = get_scraper_manager()

    for query in queries:
        normalized = normalize_text(query)
        query_offers = []

        # Cada loja tem seu próprio timeout/circuit breaker no manager. Usamos
        # gather(return_exceptions=True) para que uma loja com erro não derrube
        # as demais, sem bloquear o event loop (o antigo ThreadPoolExecutor
        # chamava shutdown(wait=True) na saída do `with`, travando o loop).
        tasks = [
            manager.scrape_store_async(
                sc, normalized, _scraper_key_for(sc), creds, force_refresh=True,
            )
            for sc, creds, _ in scrapers
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        for raw in raw_results:
            if isinstance(raw, BaseException):
                logger.error(f"refresh_products erro '{normalized}': {type(raw).__name__}: {raw}")
                continue
            offers, _, scraper_key, error_msg = raw
            if offers and not error_msg:
                await store_scraped_results(offers, scraper_key, normalized)
                query_offers.extend(offers)

        results.extend(query_offers)

    return results


def is_running() -> bool:
    return _running
