"""
Catalog Scraper — Pre-scrapes all catalog products periodically.

Runs in background, stores results in scraped_products table.
User searches become instant PostgreSQL queries instead of live scraping.
"""
import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List

from app.database import async_session
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


def _scrape_single(scraper_class, query: str, credentials: dict):
    """Run a single scraper for a single query (blocking)."""
    from app.api.routes.search import scrape_store
    return scrape_store(scraper_class, query, credentials)


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

        loop = asyncio.get_event_loop()

        for scraper_class, credentials, store_name in scrapers:
            scraper_key = scraper_class.__name__.lower().replace("scraper", "").strip("_")
            t0 = time.time()
            total_products = 0

            await _update_status(
                scraper_key,
                status="running",
                total_queries=len(queries),
                started_at=datetime.now(timezone.utc),
            )

            for query in queries:
                try:
                    normalized = normalize_text(query)
                    raw = await loop.run_in_executor(
                        None, _scrape_single, scraper_class, normalized, credentials,
                    )
                    if isinstance(raw, tuple) and len(raw) == 4:
                        offers, duration, _, error_msg = raw
                        if error_msg:
                            logger.warning(
                                f"Catalog scrape [{store_name}] '{query}': {error_msg}"
                            )
                            break
                        if offers:
                            await store_scraped_results(offers, scraper_key, normalized)
                            total_products += len(offers)
                except Exception as e:
                    logger.error(f"Catalog scrape error [{store_name}] '{query}': {e}")
                    continue

                await asyncio.sleep(0.5)

            duration = time.time() - t0
            await _update_status(
                scraper_key,
                status="done",
                total_products=total_products,
                total_queries=len(queries),
                duration_seconds=duration,
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
    loop = asyncio.get_event_loop()

    for query in queries:
        normalized = normalize_text(query)
        query_offers = []

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                loop.run_in_executor(
                    executor, _scrape_single, sc, normalized, creds,
                )
                for sc, creds, _ in scrapers
            ]
            try:
                raw_results = await asyncio.wait_for(
                    asyncio.gather(*futures, return_exceptions=True),
                    timeout=60,
                )
            except asyncio.TimeoutError:
                raw_results = []

        for raw in raw_results:
            if isinstance(raw, Exception):
                continue
            if isinstance(raw, tuple) and len(raw) == 4:
                offers, _, scraper_key, error_msg = raw
                if offers and not error_msg:
                    await store_scraped_results(offers, scraper_key, normalized)
                    query_offers.extend(offers)

        results.extend(query_offers)

    return results


def is_running() -> bool:
    return _running
