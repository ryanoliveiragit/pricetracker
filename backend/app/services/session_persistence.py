"""
Persistência de cookies de sessão de scrapers no PostgreSQL.

Usa psycopg2 (síncrono) porque os scrapers rodam em ThreadPoolExecutor
e não têm acesso ao event loop principal do asyncio.

Fluxo:
    1. App reinicia / primeira busca
    2. session_cache.get_session() → miss em memória
    3. load_cookies() → busca no DB
    4. Cookies restaurados → sessão válida sem novo login
    5. Se o site rejeitar os cookies → scraper invalida → save_cookies() na próxima
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import psycopg2
import psycopg2.extras

from app.config import settings

logger = logging.getLogger(__name__)

SESSION_TTL_DAYS = 7  # Cookies duram 7 dias no banco


def _sync_url() -> str:
    """Converte a URL asyncpg para psycopg2."""
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


def _connect():
    return psycopg2.connect(_sync_url(), connect_timeout=5)


def load_cookies(scraper_key: str, username: str) -> Optional[dict]:
    """
    Carrega cookies do DB para o scraper/usuário.
    Retorna None se não existir, inválido ou expirado.
    """
    try:
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT cookies_json, expires_at, is_valid
                    FROM scraper_sessions
                    WHERE scraper_key = %s AND username = %s
                    """,
                    (scraper_key, username),
                )
                row = cur.fetchone()
        finally:
            conn.close()

        if not row:
            return None

        cookies_json, expires_at, is_valid = row

        if not is_valid:
            logger.debug("SessionPersistence [%s]: cookies marcados inválidos", scraper_key)
            return None

        if expires_at and expires_at < datetime.now(timezone.utc):
            logger.info("SessionPersistence [%s]: cookies expirados", scraper_key)
            return None

        cookies = json.loads(cookies_json)
        logger.info(
            "SessionPersistence [%s]: %d cookies restaurados do banco para '%s'",
            scraper_key, len(cookies), username,
        )
        return cookies

    except Exception as e:
        logger.warning("SessionPersistence [%s]: erro ao carregar — %s", scraper_key, e)
        return None


def save_cookies(scraper_key: str, username: str, cookies: dict) -> None:
    """
    Salva cookies no DB com TTL de SESSION_TTL_DAYS dias.
    Faz UPSERT — atualiza se já existir entrada para o scraper_key.
    """
    if not cookies:
        return
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scraper_sessions
                        (scraper_key, username, cookies_json, saved_at, expires_at, is_valid)
                    VALUES (%s, %s, %s, NOW(), %s, TRUE)
                    ON CONFLICT (scraper_key) DO UPDATE SET
                        username    = EXCLUDED.username,
                        cookies_json = EXCLUDED.cookies_json,
                        saved_at    = NOW(),
                        expires_at  = EXCLUDED.expires_at,
                        is_valid    = TRUE
                    """,
                    (scraper_key, username, json.dumps(cookies), expires_at),
                )
                conn.commit()
        finally:
            conn.close()
        logger.info(
            "SessionPersistence [%s]: %d cookies salvos (TTL %dd)",
            scraper_key, len(cookies), SESSION_TTL_DAYS,
        )
    except Exception as e:
        logger.warning("SessionPersistence [%s]: erro ao salvar — %s", scraper_key, e)


def invalidate_cookies(scraper_key: str) -> None:
    """Marca os cookies do scraper como inválidos no DB."""
    try:
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE scraper_sessions SET is_valid = FALSE WHERE scraper_key = %s",
                    (scraper_key,),
                )
                conn.commit()
        finally:
            conn.close()
        logger.info("SessionPersistence [%s]: cookies invalidados no banco", scraper_key)
    except Exception as e:
        logger.warning("SessionPersistence [%s]: erro ao invalidar — %s", scraper_key, e)


def list_sessions() -> list[dict]:
    """Retorna todas as sessões (para endpoint admin)."""
    try:
        conn = _connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT scraper_key, username, saved_at, expires_at, is_valid,
                           LENGTH(cookies_json) as cookies_size
                    FROM scraper_sessions
                    ORDER BY saved_at DESC
                    """
                )
                rows = cur.fetchall()
        finally:
            conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.warning("SessionPersistence: erro ao listar sessões — %s", e)
        return []


def delete_session(scraper_key: str) -> bool:
    """Remove completamente uma sessão do banco (força novo login)."""
    try:
        conn = _connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM scraper_sessions WHERE scraper_key = %s",
                    (scraper_key,),
                )
                deleted = cur.rowcount
                conn.commit()
        finally:
            conn.close()
        return deleted > 0
    except Exception as e:
        logger.warning("SessionPersistence [%s]: erro ao deletar — %s", scraper_key, e)
        return False
