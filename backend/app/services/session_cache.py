"""
Cache de sessões autenticadas para scrapers.

Hierarquia de persistência:
    1. Memória (dict) — mais rápido, dura enquanto o processo estiver vivo
    2. Banco de dados (PostgreSQL via psycopg2) — persiste entre restarts

Fluxo de get_session():
    memória hit  → retorna imediatamente
    memória miss → tenta restaurar cookies do banco → popula memória → retorna
    banco miss   → retorna None (scraper faz login normalmente)

Fluxo de store_session():
    salva em memória + persiste cookies no banco

Fluxo de invalidate():
    remove da memória + marca como inválido no banco
    (próxima busca fará login fresco e salvará novos cookies)
"""
import logging
import threading
import requests

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_login_locks: dict[str, threading.Lock] = {}

# { scraper_key: { "session": requests.Session, "user": str } }
_cache: dict[str, dict] = {}


def get_login_lock(scraper_key: str) -> threading.Lock:
    """Retorna (criando se necessário) um lock exclusivo por scraper."""
    with _lock:
        if scraper_key not in _login_locks:
            _login_locks[scraper_key] = threading.Lock()
        return _login_locks[scraper_key]


def get_session(scraper_key: str, username: str) -> requests.Session | None:
    """
    Retorna sessão autenticada.

    Prioridade:
        1. Memória (sem I/O)
        2. Banco de dados → restaura cookies em sessão nova
    """
    # ── 1. Memória ──────────────────────────────────────────────
    with _lock:
        entry = _cache.get(scraper_key)
        if entry and entry.get("user") == username and entry.get("session"):
            logger.info(
                "SessionCache [%s]: reutilizando sessão em memória de '%s'",
                scraper_key, username,
            )
            return entry["session"]

    # ── 2. Banco de dados ────────────────────────────────────────
    try:
        from app.services.session_persistence import load_cookies
        cookies = load_cookies(scraper_key, username)
        if cookies:
            session = requests.Session()
            session.cookies.update(cookies)
            with _lock:
                _cache[scraper_key] = {"user": username, "session": session}
            logger.info(
                "SessionCache [%s]: sessão restaurada do banco para '%s' (%d cookies)",
                scraper_key, username, len(cookies),
            )
            return session
    except Exception as e:
        logger.warning(
            "SessionCache [%s]: erro ao restaurar sessão do banco — %s",
            scraper_key, e,
        )

    return None


def store_session(scraper_key: str, username: str, session: requests.Session) -> None:
    """
    Armazena sessão autenticada em memória e persiste os cookies no banco.
    """
    # ── Memória ──────────────────────────────────────────────────
    with _lock:
        _cache[scraper_key] = {"user": username, "session": session}

    # ── Banco (não bloqueia se falhar) ───────────────────────────
    try:
        from app.services.session_persistence import save_cookies
        cookies = dict(session.cookies)
        if cookies:
            save_cookies(scraper_key, username, cookies)
        else:
            logger.debug(
                "SessionCache [%s]: sessão sem cookies — não persistindo no banco",
                scraper_key,
            )
    except Exception as e:
        logger.warning(
            "SessionCache [%s]: erro ao persistir cookies no banco — %s",
            scraper_key, e,
        )

    logger.info("SessionCache [%s]: sessão armazenada para '%s'", scraper_key, username)


def invalidate(scraper_key: str) -> None:
    """
    Remove sessão da memória e invalida no banco.
    Próxima busca fará login fresco e salvará novos cookies.
    """
    with _lock:
        if scraper_key in _cache:
            del _cache[scraper_key]

    try:
        from app.services.session_persistence import invalidate_cookies
        invalidate_cookies(scraper_key)
    except Exception as e:
        logger.warning(
            "SessionCache [%s]: erro ao invalidar no banco — %s",
            scraper_key, e,
        )

    logger.info(
        "SessionCache [%s]: sessão invalidada — próxima busca fará login",
        scraper_key,
    )
