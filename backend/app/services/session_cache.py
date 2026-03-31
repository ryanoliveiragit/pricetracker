"""
Cache global de sessões autenticadas para scrapers.
Sessões ficam ativas indefinidamente — só refaz login se a busca retornar erro de auth.
"""
import logging
import threading
import requests

logger = logging.getLogger(__name__)

_lock = threading.Lock()

# { scraper_key: { "session": requests.Session, "user": str } }
_cache: dict[str, dict] = {}


def get_session(scraper_key: str, username: str) -> requests.Session | None:
    """Retorna sessão cacheada se existir para o mesmo usuário."""
    with _lock:
        entry = _cache.get(scraper_key)
        if entry and entry.get("user") == username and entry.get("session"):
            logger.info("SessionCache [%s]: reutilizando sessão de '%s'", scraper_key, username)
            return entry["session"]
    return None


def store_session(scraper_key: str, username: str, session: requests.Session) -> None:
    """Armazena sessão autenticada."""
    with _lock:
        _cache[scraper_key] = {"user": username, "session": session}
    logger.info("SessionCache [%s]: sessão armazenada para '%s'", scraper_key, username)


def invalidate(scraper_key: str) -> None:
    """Remove sessão cacheada, forçando novo login na próxima busca."""
    with _lock:
        if scraper_key in _cache:
            del _cache[scraper_key]
    logger.info("SessionCache [%s]: sessão invalidada — próxima busca fará login", scraper_key)
