#!/usr/bin/env python3
"""Semeia uma sessão autenticada da Gigavale (cookies) no cache do app.

A Gigavale usa reCAPTCHA v2 invisível, que não passa via Selenium automatizado.
A solução é logar UMA vez manualmente e guardar os cookies da sessão. O backend
então reutiliza esses cookies (scraper_sessions no Postgres) sem abrir navegador,
enquanto a sessão durar.

Recomendado: deixe `GIGAVALE_MANUAL_SESSION_ONLY=1` no backend/.env para o scraper
NÃO tentar o login por Selenium (que gastaria ~60s e falharia no reCAPTCHA) e sim
falhar rápido pedindo para re-semear quando a sessão expirar.

Modos de uso (rode de dentro de backend/):

  1) Interativo — abre o Chrome, VOCÊ loga na mão, o script captura os cookies:
       python seed_gigavale_session.py --interactive

  2) Importar cookies exportados do SEU navegador (extensão "EditThisCookie",
     "Cookie-Editor", ou o JSON do DevTools):
       python seed_gigavale_session.py --cookies-file cookies.json

  3) Ver o estado atual da sessão semeada:
       python seed_gigavale_session.py --status
"""
import argparse
import json
import os
import sys
import time

# --- bootstrap: sys.path + .env (igual ao main.py) ---
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_HERE, ".env"))
except Exception:
    pass

import psycopg2
from datetime import datetime, timezone, timedelta

from app.config import settings
from app.scrapers.gigavale_scraper import BASE_URL, CACHE_KEY, HEADERS, GigavaleScraper

DEFAULT_USERNAME = "bomretiro_materiais@hotmail.com"


def _sync_url() -> str:
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


def _resolve_username(cli_username: str | None) -> str:
    """Usa o --username informado ou busca o username do fornecedor Gigavale no DB."""
    if cli_username:
        return cli_username
    try:
        conn = psycopg2.connect(_sync_url(), connect_timeout=5)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT username FROM suppliers "
                    "WHERE lower(name) LIKE '%gigavale%' AND username <> '' "
                    "ORDER BY username LIMIT 1"
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row and row[0]:
            return row[0]
    except Exception as e:
        print(f"  (aviso: não consegui ler o username do DB: {e})")
    return DEFAULT_USERNAME


def _normalize_cookies(raw) -> dict:
    """Aceita {name: value}, lista de {name,value,...} ou {name: {value:...}}."""
    out: dict[str, str] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            if isinstance(v, dict) and "value" in v:
                out[k] = str(v["value"])
            else:
                out[k] = str(v)
    elif isinstance(raw, list):
        for c in raw:
            if isinstance(c, dict) and c.get("name") is not None:
                out[str(c["name"])] = str(c.get("value", ""))
    return {k: v for k, v in out.items() if k}


def _verify(cookies: dict) -> bool:
    """Confere se os cookies autenticam de verdade (mesma lógica do runtime)."""
    scraper = GigavaleScraper()
    scraper.session.cookies.update(cookies)
    scraper.session.headers.update(HEADERS)
    return scraper._session_is_authenticated()


BACKUP_FILE = os.path.join(_HERE, "gigavale_cookies.json")


def _backup_to_file(cookies: dict) -> str:
    with open(BACKUP_FILE, "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False, indent=2)
    return BACKUP_FILE


def _persist(username: str, cookies: dict, ttl_days: int) -> str:
    """Salva no Postgres; se o banco estiver fora, grava em arquivo de backup.
    Retorna 'db' ou 'file'."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    try:
        conn = psycopg2.connect(_sync_url(), connect_timeout=5)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO scraper_sessions
                        (scraper_key, username, cookies_json, saved_at, expires_at, is_valid)
                    VALUES (%s, %s, %s, NOW(), %s, TRUE)
                    ON CONFLICT (scraper_key) DO UPDATE SET
                        username     = EXCLUDED.username,
                        cookies_json = EXCLUDED.cookies_json,
                        saved_at     = NOW(),
                        expires_at   = EXCLUDED.expires_at,
                        is_valid     = TRUE
                    """,
                    (CACHE_KEY, username, json.dumps(cookies), expires_at),
                )
                conn.commit()
        finally:
            conn.close()
        return "db"
    except Exception as e:
        path = _backup_to_file(cookies)
        print(f"  ⚠️  Não consegui salvar no Postgres ({type(e).__name__}). "
              f"Cookies gravados em {path}.")
        print(f"     Quando o banco subir, rode: python seed_gigavale_session.py --cookies-file {path}")
        return "file"


def cmd_status() -> int:
    conn = psycopg2.connect(_sync_url(), connect_timeout=5)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT username, saved_at, expires_at, is_valid, LENGTH(cookies_json), cookies_json "
                "FROM scraper_sessions WHERE scraper_key = %s",
                (CACHE_KEY,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        print("Gigavale: nenhuma sessão semeada ainda.")
        return 1
    username, saved_at, expires_at, is_valid, size, cookies_json = row
    print(f"Gigavale sessão: username={username} is_valid={is_valid}")
    print(f"  salva em: {saved_at}  expira em: {expires_at}  (bytes={size})")
    try:
        cookies = json.loads(cookies_json)
        ok = _verify(cookies)
        print(f"  autentica agora? {'SIM ✅' if ok else 'NÃO ❌ (re-semeie)'}")
        return 0 if ok else 1
    except Exception as e:
        print(f"  erro ao verificar: {e}")
        return 1


def cmd_import(path: str | None, inline: str | None, username: str, ttl_days: int, verify: bool) -> int:
    if path:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    elif inline:
        raw = json.loads(inline)
    else:
        print("Erro: informe --cookies-file ou --cookies-json"); return 2
    cookies = _normalize_cookies(raw)
    if not cookies:
        print("Erro: nenhum cookie válido encontrado no arquivo/JSON."); return 2
    print(f"Importando {len(cookies)} cookies para username={username} ...")
    if verify and not _verify(cookies):
        print("❌ Os cookies NÃO autenticam na Gigavale. Faça login de novo e reexporte "
              "(confira se copiou a sessão logada e do domínio gigavaleatacado.com.br).")
        return 1
    where = _persist(username, cookies, ttl_days)
    if where == "db":
        print(f"✅ Sessão salva no banco (TTL {ttl_days} dias). O backend já vai reutilizar esses cookies.")
    return 0


def cmd_interactive(username: str, ttl_days: int, timeout: int, verify: bool) -> int:
    try:
        from selenium import webdriver
    except ImportError:
        print("Erro: selenium não instalado no venv."); return 2

    options = webdriver.ChromeOptions()
    binary = GigavaleScraper._chrome_binary()
    if binary:
        options.binary_location = binary
    options.add_argument("--window-size=1280,900")
    options.add_argument("--lang=pt-BR")
    options.add_argument(f"--user-agent={HEADERS['User-Agent']}")
    try:
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
    except Exception:
        pass

    print(f"Abrindo o Chrome em {BASE_URL}/entrar ...")
    print(">>> FAÇA O LOGIN MANUALMENTE na janela que abriu (resolva o reCAPTCHA).")
    print(f">>> Aguardando até {timeout}s pela confirmação do login...")
    driver = webdriver.Chrome(options=options)
    try:
        driver.get(BASE_URL + "/entrar")
        deadline = time.time() + timeout
        authed = False
        while time.time() < deadline:
            try:
                if GigavaleScraper._is_authenticated_html(driver.page_source) or "/entrar" not in driver.current_url:
                    # dá um instante para os cookies de sessão assentarem
                    time.sleep(2)
                    if GigavaleScraper._is_authenticated_html(driver.page_source):
                        authed = True
                        break
            except Exception:
                pass
            time.sleep(2)
        if not authed:
            print("❌ Não detectei o login dentro do tempo. Rode de novo e conclua o login.")
            return 1
        cookies = {c["name"]: c["value"] for c in driver.get_cookies()}
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    print(f"Capturei {len(cookies)} cookies.")
    backup = _backup_to_file(cookies)
    print(f"Backup salvo em {backup}")
    if verify:
        print("Verificando se os cookies autenticam na Gigavale...")
        if not _verify(cookies):
            print("❌ Os cookies capturados NÃO autenticaram (login pode não ter concluído).")
            print(f"   O backup está em {backup} caso queira importar manualmente depois.")
            return 1
        print("✅ Autenticou.")
    where = _persist(username, cookies, ttl_days)
    if where == "db":
        print(f"✅ Sessão da Gigavale salva no banco (username={username}, TTL {ttl_days} dias).")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Semeia a sessão autenticada da Gigavale.")
    ap.add_argument("--interactive", action="store_true", help="abre o Chrome para login manual")
    ap.add_argument("--cookies-file", help="importa cookies de um arquivo JSON")
    ap.add_argument("--cookies-json", help="importa cookies de um JSON inline")
    ap.add_argument("--status", action="store_true", help="mostra o estado da sessão atual")
    ap.add_argument("--username", help="username do fornecedor Gigavale (default: lê do DB)")
    ap.add_argument("--ttl-days", type=int, default=30, help="validade da sessão no cache (default 30)")
    ap.add_argument("--timeout", type=int, default=300, help="segundos de espera no modo interativo")
    ap.add_argument("--no-verify", action="store_true", help="não verifica os cookies antes de salvar")
    args = ap.parse_args()

    if args.status:
        return cmd_status()

    username = _resolve_username(args.username)
    verify = not args.no_verify

    if args.cookies_file or args.cookies_json:
        return cmd_import(args.cookies_file, args.cookies_json, username, args.ttl_days, verify)
    # default = interativo
    return cmd_interactive(username, args.ttl_days, args.timeout, verify)


if __name__ == "__main__":
    sys.exit(main())
