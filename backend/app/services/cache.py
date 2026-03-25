"""
Cache Service — PostgreSQL-backed with in-memory fallback.

Lógica de cache inteligente:
  1. Busca no DB se existe cache para (scraper_key, query)
  2. Se existe e está dentro do TTL → retorna do cache (instantâneo)
  3. Se existe mas expirou → faz novo scraping → atualiza no DB
  4. Se não existe → faz scraping → salva no DB
  5. force_refresh → ignora cache, faz scraping, atualiza no DB
"""
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# DB-backed cache operations (async)
# ──────────────────────────────────────────────

async def db_cache_get(scraper_key: str, query: str, ttl_seconds: int = 1800) -> Optional[list]:
    """
    Busca resultados cacheados no PostgreSQL.
    Retorna None se não encontrado ou se expirou o TTL.
    """
    try:
        from app.database import async_session
        from app.models.db_models import SearchCacheDB
        from sqlalchemy import select, and_

        async with async_session() as session:
            stmt = select(SearchCacheDB).where(
                and_(
                    SearchCacheDB.scraper_key == scraper_key,
                    SearchCacheDB.query == query,
                )
            )
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()

            if entry is None:
                return None

            # Verificar TTL
            age = datetime.now(timezone.utc) - entry.updated_at.replace(tzinfo=timezone.utc)
            if age > timedelta(seconds=ttl_seconds):
                logger.info(f"   ⏰ Cache expirado ({age.total_seconds():.0f}s > {ttl_seconds}s) — {scraper_key}:{query}")
                return None

            logger.info(f"   ✅ CACHE HIT [postgresql] — {scraper_key}:{query} ({entry.result_count} produtos, age={age.total_seconds():.0f}s)")
            return entry.results
    except Exception as exc:
        logger.warning(f"DB cache GET erro: {exc}")
        return None


async def db_cache_set(scraper_key: str, query: str, results: list) -> None:
    """
    Salva ou atualiza resultados no cache do PostgreSQL.
    Se já existe entrada para (scraper_key, query), atualiza. Senão, cria nova.
    """
    try:
        from app.database import async_session
        from app.models.db_models import SearchCacheDB
        from sqlalchemy import select, and_

        async with async_session() as session:
            stmt = select(SearchCacheDB).where(
                and_(
                    SearchCacheDB.scraper_key == scraper_key,
                    SearchCacheDB.query == query,
                )
            )
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()

            now = datetime.now(timezone.utc)
            if entry:
                entry.results = results
                entry.result_count = len(results)
                entry.updated_at = now
            else:
                entry = SearchCacheDB(
                    scraper_key=scraper_key,
                    query=query,
                    results=results,
                    result_count=len(results),
                    created_at=now,
                    updated_at=now,
                )
                session.add(entry)

            await session.commit()
            logger.info(f"   💾 Cache salvo [postgresql] — {scraper_key}:{query} ({len(results)} produtos)")
    except Exception as exc:
        logger.warning(f"DB cache SET erro: {exc}")


async def db_cache_clear() -> int:
    """Limpa todo o cache de buscas. Retorna quantas entradas foram removidas."""
    try:
        from app.database import async_session
        from app.models.db_models import SearchCacheDB
        from sqlalchemy import delete

        async with async_session() as session:
            result = await session.execute(delete(SearchCacheDB))
            await session.commit()
            count = result.rowcount
            logger.info(f"🗑️  Cache limpo: {count} entradas removidas")
            return count
    except Exception as exc:
        logger.warning(f"DB cache CLEAR erro: {exc}")
        return 0


# ──────────────────────────────────────────────
# Scrape timing — DB-backed
# ──────────────────────────────────────────────

async def record_scrape_time_db(scraper_key: str, duration_seconds: float, query: str = "") -> None:
    """Registra o tempo de um scraping no banco de dados."""
    try:
        from app.database import async_session
        from app.models.db_models import ScrapeTimingDB

        async with async_session() as session:
            timing = ScrapeTimingDB(
                scraper_key=scraper_key,
                duration_seconds=duration_seconds,
                query=query,
                created_at=datetime.now(timezone.utc),
            )
            session.add(timing)
            await session.commit()
    except Exception as exc:
        logger.warning(f"Timing record erro: {exc}")


async def get_estimated_wait_db(scraper_key: str, limit: int = 20) -> Optional[float]:
    """Retorna a média dos últimos N tempos de scraping do banco, ou None se sem histórico."""
    try:
        from app.database import async_session
        from app.models.db_models import ScrapeTimingDB
        from sqlalchemy import select, func

        async with async_session() as session:
            # Subquery: pegar os últimos N registros, depois calcular média
            subq = (
                select(ScrapeTimingDB.duration_seconds)
                .where(ScrapeTimingDB.scraper_key == scraper_key)
                .order_by(ScrapeTimingDB.created_at.desc())
                .limit(limit)
                .subquery()
            )
            stmt = select(func.avg(subq.c.duration_seconds))
            result = await session.execute(stmt)
            avg = result.scalar()
            return round(avg, 1) if avg else None
    except Exception as exc:
        logger.warning(f"Timing estimate erro: {exc}")
        return None


async def get_all_estimates_db() -> dict[str, float]:
    """Retorna estimativas de tempo para todos os scrapers conhecidos."""
    try:
        from app.database import async_session
        from app.models.db_models import ScrapeTimingDB
        from sqlalchemy import select, func

        async with async_session() as session:
            stmt = (
                select(
                    ScrapeTimingDB.scraper_key,
                    func.avg(ScrapeTimingDB.duration_seconds),
                )
                .group_by(ScrapeTimingDB.scraper_key)
            )
            result = await session.execute(stmt)
            return {row[0]: round(row[1], 1) for row in result.all()}
    except Exception as exc:
        logger.warning(f"All estimates erro: {exc}")
        return {}


# ──────────────────────────────────────────────
# In-memory fallback (kept for backwards compat)
# ──────────────────────────────────────────────

_mem_cache: dict[str, tuple[Any, float]] = {}


def mem_cache_get(key: str) -> Optional[Any]:
    entry = _mem_cache.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _mem_cache[key]
        return None
    return value


def mem_cache_set(key: str, value: Any, ttl: int = 1800) -> None:
    _mem_cache[key] = (value, time.time() + ttl)
