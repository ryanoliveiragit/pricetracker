"""
Executa um prompt de correção usando Claude API (ou Groq como fallback).
Retorna mudanças de arquivo estruturadas para revisão e aplicação.
"""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)


def _fix_unescaped_quotes(s: str) -> str:
    """
    Repair JSON where string values contain unescaped double quotes.
    Heuristic: a closing quote is one followed (after optional whitespace) by
    ,  }  ]  or  :  — any other quote inside a string is an unescaped internal
    quote and gets escaped.
    """
    out: list[str] = []
    i = 0
    in_str = False
    while i < len(s):
        c = s[i]
        if c == "\\" and in_str and i + 1 < len(s):
            out.append(c)
            out.append(s[i + 1])
            i += 2
            continue
        if c == '"':
            if not in_str:
                in_str = True
                out.append(c)
            else:
                first_nonws = (s[i + 1:].lstrip() or " ")[0]
                if first_nonws in ",}]:":
                    in_str = False
                    out.append(c)
                else:
                    out.append("\\")
                    out.append('"')
        else:
            out.append(c)
        i += 1
    return "".join(out)


def _extract_json(raw: str) -> dict:
    """Extrai JSON de uma resposta que pode ter markdown ou texto ao redor."""

    def _try(s: str) -> dict | None:
        try:
            return json.loads(s)
        except Exception:
            return None

    # 1. json.loads direto
    r = _try(raw)
    if r is not None:
        return r

    # 2. bloco ```json ... ``` — com e sem repair de aspas
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        content = m.group(1)
        r = _try(content) or _try(_fix_unescaped_quotes(content))
        if r is not None:
            return r

    # 3. encontra { ... } externo respeitando strings — com e sem repair
    start = raw.find("{")
    if start != -1:
        depth, in_str, escape = 0, False, False
        for i, ch in enumerate(raw[start:], start):
            if escape:
                escape = False
            elif ch == "\\" and in_str:
                escape = True
            elif ch == '"':
                in_str = not in_str
            elif not in_str:
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        fragment = raw[start:i + 1]
                        r = _try(fragment) or _try(_fix_unescaped_quotes(fragment))
                        if r is not None:
                            return r
                        break

    # 4. último recurso: repair sobre o raw inteiro
    r = _try(_fix_unescaped_quotes(raw))
    if r is not None:
        return r

    logger.error("auto_fix_agent: resposta bruta não contém JSON válido:\n%s", raw)
    raise ValueError(f"Resposta da IA não contém JSON válido: {raw[:200]}")

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent  # raiz do projeto

_SYSTEM = """Você é um desenvolvedor sênior implementando uma mudança no projeto ConstruPrice.

Stack:
- Backend: Python/FastAPI em backend/
- Frontend: Next.js 14 / TypeScript / Tailwind CSS em frontend/src/

Você receberá:
1. A solicitação de mudança
2. Conteúdo dos arquivos relevantes

Retorne APENAS JSON válido (sem markdown, sem explicação fora do JSON):
{
  "changes": [
    {
      "file": "caminho/relativo/ao/projeto",
      "old": "string exata a substituir",
      "new": "string de substituição"
    }
  ],
  "summary": "descrição curta do que foi alterado"
}

Regras CRÍTICAS:
- "old" deve ser a MENOR substring única possível — idealmente 2-5 palavras, nunca a linha inteira
- "old" JAMAIS deve conter aspas duplas (") — escolha um trecho que não tenha esse caractere
  ERRADO: "old": "import { Home, Search, LogOut } from 'lucide-react';"  ← linha inteira
  ERRADO: "old": "LogOut } from \"lucide-react\""  ← contém aspas
  CERTO:  "old": "LogOut,"                          ← trecho simples sem aspas
  CERTO:  "old": "Settings, LogOut"                 ← trecho simples sem aspas
- "new" nunca deve ter mais que 150 chars e nunca deve conter aspas duplas
- Máximo 2 changes no total
- Preserve estilo existente (TypeScript, Tailwind, dark mode com dark:)
- Se não precisar alterar nada: {"changes": [], "summary": "Sem mudanças necessárias"}"""


# ---------------------------------------------------------------------------
# Seleção de arquivos de contexto por fix_type
# ---------------------------------------------------------------------------

_CONTEXT_GLOBS: dict[str, list[str]] = {
    "ui_change": [
        "frontend/src/layouts/*.tsx",
        "frontend/src/components/*.tsx",
    ],
    "feature_request": [
        "frontend/src/layouts/*.tsx",
        "frontend/src/views/*.tsx",
        "backend/app/api/routes/*.py",
    ],
    "bug_fix": [
        "backend/app/api/routes/*.py",
        "backend/app/services/*.py",
        "frontend/src/services/*.ts",
    ],
}

MAX_FILE_LINES = 40
MAX_FILES = 1


def _collect_context(fix_type: str, prompt: str) -> str:
    """Coleta arquivos relevantes como contexto para a IA."""
    import glob as _glob

    globs = _CONTEXT_GLOBS.get(fix_type, _CONTEXT_GLOBS["ui_change"])
    candidates: list[Path] = []
    for pattern in globs:
        full_pattern = str(PROJECT_ROOT / pattern)
        candidates.extend(Path(p) for p in _glob.glob(full_pattern))

    # Prioriza arquivos cujo nome aparece no prompt
    prompt_lower = prompt.lower()
    def score(p: Path) -> int:
        name = p.stem.lower()
        return 2 if name in prompt_lower else (1 if any(w in prompt_lower for w in name.split()) else 0)

    candidates.sort(key=score, reverse=True)
    candidates = candidates[:MAX_FILES]

    parts: list[str] = []
    for path in candidates:
        try:
            raw_lines = path.read_text(encoding="utf-8").splitlines()[:MAX_FILE_LINES]
            # Strip import lines — they contain double-quoted module names which
            # cause the AI to generate invalid JSON (unescaped quotes in "old").
            lines = [l for l in raw_lines if not l.strip().startswith(("import ", "from "))]
            rel = path.relative_to(PROJECT_ROOT)
            parts.append(f"### {rel}\n```\n{chr(10).join(lines)}\n```")
        except Exception:
            pass

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Provider: Anthropic Claude
# ---------------------------------------------------------------------------

def _claude_execute_sync(api_key: str, user_msg: str) -> dict:
    import urllib.request

    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 4096,
        "system": _SYSTEM,
        "messages": [{"role": "user", "content": user_msg}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())

    raw = body["content"][0]["text"].strip()
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Provider: Gemini
# ---------------------------------------------------------------------------

def _gemini_execute_sync(api_key: str, user_msg: str) -> dict:
    import urllib.request, urllib.error
    payload = json.dumps({
        "systemInstruction": {"parts": [{"text": _SYSTEM}]},
        "contents": [{"parts": [{"text": user_msg}]}],
        "generationConfig": {"maxOutputTokens": 3072, "temperature": 0.1},
    }).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")
        raise RuntimeError(f"Gemini API {e.code}: {detail[:200]}")
    raw = body["candidates"][0]["content"]["parts"][0]["text"].strip()
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Provider: Perplexity
# ---------------------------------------------------------------------------

def _perplexity_execute_sync(api_key: str, user_msg: str) -> dict:
    import urllib.request, urllib.error
    payload = json.dumps({
        "model": "sonar",
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        "max_tokens": 3072,
        "temperature": 0.1,
    }).encode()
    req = urllib.request.Request(
        "https://api.perplexity.ai/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")
        raise RuntimeError(f"Perplexity API {e.code}: {detail[:200]}")
    raw = body["choices"][0]["message"]["content"].strip()
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Provider: Groq (fallback)
# ---------------------------------------------------------------------------

def _groq_execute_sync(api_key: str, user_msg: str) -> dict:
    import time
    import urllib.error
    import urllib.request

    payload = json.dumps({
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        "max_tokens": 3072,
        "temperature": 0.1,
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "groq-python/0.9.0",
        },
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read().decode())
            break
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="ignore")
            if e.code == 429 and attempt < 2:
                wait = 20
                m = re.search(r"try again in (\d+(?:\.\d+)?)s", detail)
                if m:
                    wait = min(int(float(m.group(1))) + 2, 60)
                logger.warning("auto_fix_agent: Groq 429 — aguardando %ds…", wait)
                time.sleep(wait)
                continue
            try:
                detail = json.loads(detail).get("error", {}).get("message", detail)
            except Exception:
                pass
            raise RuntimeError(f"Groq API {e.code}: {detail}")

    raw = body["choices"][0]["message"]["content"].strip()
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def execute_fix(prompt: str, fix_type: str) -> dict:
    """Tenta Claude → Gemini → Perplexity → Groq."""
    import asyncio
    from app.config import settings

    context = _collect_context(fix_type, prompt)
    user_msg = f"{prompt}\n\n---\nArquivos relevantes do projeto:\n\n{context}"

    providers = []
    if (settings.ANTHROPIC_API_KEY or "").strip():
        providers.append(("Claude",      _claude_execute_sync,      settings.ANTHROPIC_API_KEY))
    if (settings.GEMINI_API_KEY or "").strip():
        providers.append(("Gemini",      _gemini_execute_sync,      settings.GEMINI_API_KEY))
    if (settings.PERPLEXITY_API_KEY or "").strip():
        providers.append(("Perplexity",  _perplexity_execute_sync,  settings.PERPLEXITY_API_KEY))
    if (settings.GROQ_API_KEY or "").strip():
        providers.append(("Groq",        _groq_execute_sync,        settings.GROQ_API_KEY))

    if not providers:
        raise RuntimeError("Nenhum provider configurado — adicione GEMINI_API_KEY, ANTHROPIC_API_KEY ou GROQ_API_KEY no .env")

    last_exc: Exception = RuntimeError("providers esgotados")
    for name, fn, key in providers:
        try:
            logger.info("auto_fix_agent: chamando %s…", name)
            result = await asyncio.to_thread(fn, key.strip(), user_msg)
            logger.info("auto_fix_agent: %s respondeu:\n%s", name, json.dumps(result, ensure_ascii=False, indent=2))
            return result
        except Exception as exc:
            logger.warning("auto_fix_agent: %s falhou — %s", name, exc)
            last_exc = exc

    raise last_exc


def _fuzzy_replace(content: str, old: str, new: str, threshold: float = 0.82) -> str | None:
    """
    Tenta encontrar a linha mais parecida com `old` no conteúdo e substituir.
    Retorna o conteúdo modificado ou None se não encontrou match suficiente.
    """
    import difflib

    old_stripped = old.strip()
    lines = content.splitlines(keepends=True)
    n_old = len(old.splitlines())

    best_ratio = 0.0
    best_i = -1

    for i in range(len(lines) - n_old + 1):
        window = "".join(lines[i:i + n_old]).strip()
        ratio = difflib.SequenceMatcher(None, old_stripped, window, autojunk=False).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_i = i

    if best_ratio < threshold or best_i == -1:
        logger.debug("fuzzy_replace: melhor ratio=%.2f < %.2f — sem match", best_ratio, threshold)
        return None

    window_raw = "".join(lines[best_i:best_i + n_old])
    logger.info("fuzzy_replace: match ratio=%.2f, substituindo linhas %d-%d", best_ratio, best_i + 1, best_i + n_old)
    return content.replace(window_raw, new, 1)


def apply_changes(changes: list[dict]) -> list[dict]:
    """Aplica mudanças nos arquivos. Tenta match exato, cai em fuzzy se falhar."""
    results = []
    for change in changes:
        file_path = PROJECT_ROOT / change["file"]
        old = change.get("old", "")
        new = change.get("new", "")
        try:
            content = file_path.read_text(encoding="utf-8")
            if old in content:
                file_path.write_text(content.replace(old, new, 1), encoding="utf-8")
                results.append({"file": change["file"], "status": "applied"})
            else:
                # fallback fuzzy
                patched = _fuzzy_replace(content, old, new)
                if patched is not None:
                    file_path.write_text(patched, encoding="utf-8")
                    results.append({"file": change["file"], "status": "applied", "method": "fuzzy"})
                else:
                    logger.warning("apply_changes: not_found em %s\nold=%r", change["file"], old[:120])
                    results.append({"file": change["file"], "status": "not_found",
                                    "error": "Trecho não encontrado (exact nem fuzzy)"})
        except Exception as e:
            results.append({"file": change["file"], "status": "error", "error": str(e)})
    return results


def apply_and_validate(changes: list[dict]) -> tuple[list[dict], str | None]:
    """
    Aplica mudanças, roda tsc --noEmit + eslint e reverte se falhar.
    Retorna (results, error). error é None se passou.
    """
    import subprocess
    import sys

    use_shell = sys.platform == "win32"
    frontend_path = PROJECT_ROOT / "frontend"

    def _revert() -> None:
        for file, original in originals.items():
            if original is not None:
                (PROJECT_ROOT / file).write_text(original, encoding="utf-8")

    def _run(cmd: str, label: str, timeout: int = 120) -> str | None:
        """Roda comando no frontend. Retorna mensagem de erro ou None."""
        try:
            proc = subprocess.run(
                cmd, cwd=str(frontend_path), capture_output=True,
                text=True, timeout=timeout, shell=use_shell,
            )
            if proc.returncode != 0:
                out = (proc.stdout + proc.stderr).strip()
                logger.warning("auto_fix_agent: %s falhou:\n%s", label, out)
                return f"{label} falhou — mudanças revertidas:\n{out}"
            logger.info("auto_fix_agent: %s passou ✅", label)
        except subprocess.TimeoutExpired:
            logger.warning("auto_fix_agent: %s timeout — revertendo", label)
            return f"{label} timeout — mudanças revertidas"
        except FileNotFoundError:
            logger.warning("auto_fix_agent: npx não encontrado — pulando %s", label)
        return None

    # Salva originais
    originals: dict[str, str | None] = {}
    for change in changes:
        fp = PROJECT_ROOT / change["file"]
        try:
            originals[change["file"]] = fp.read_text(encoding="utf-8")
        except FileNotFoundError:
            originals[change["file"]] = None

    results = apply_changes(changes)
    if any(r["status"] != "applied" for r in results):
        _revert()
        return results, "Nem todas as mudanças puderam ser aplicadas — revertido"

    has_ts = any(
        c["file"].startswith("frontend/") and c["file"].endswith((".ts", ".tsx"))
        for c in changes
    )
    if not has_ts:
        logger.info("auto_fix_agent: sem arquivos TS — pulando validação")
        return results, None

    # 1. tsc
    err = _run("npx tsc --noEmit", "tsc")
    if err:
        _revert()
        return results, err

    # 2. eslint nos arquivos alterados
    ts_files = " ".join(
        f'"{c["file"].replace("frontend/", "")}"'
        for c in changes
        if c["file"].startswith("frontend/") and c["file"].endswith((".ts", ".tsx"))
    )
    if ts_files:
        err = _run(f"npx eslint --max-warnings 0 {ts_files}", "eslint")
        if err:
            _revert()
            return results, err

    return results, None


# ---------------------------------------------------------------------------
# Chat Agent — acesso completo ao código-fonte
# ---------------------------------------------------------------------------

_CHAT_SYSTEM = """Você é um consultor técnico do projeto ConstruPrice (plataforma de cotação de preços para construção civil).

Seu papel é PLANEJAR junto ao administrador o que precisa ser mudado no código — sem aplicar nada ainda.

Você tem acesso ao código-fonte completo abaixo.

## Objetivo
Conversar para entender com precisão o que mudar. Quando o admin confirmar o plano, gere um "refined_prompt" com instruções técnicas precisas para execução futura.

## Formato de resposta (JSON válido obrigatório — sem markdown fora do JSON)

Conversando / planejando:
{"text": "Sua resposta em linguagem natural", "refined_prompt": null}

Plano confirmado (quando admin disser ok/confirmar/pode executar/sim):
{"text": "Perfeito! Prompt técnico gerado.", "refined_prompt": "Descrição técnica precisa: arquivo, trecho específico a alterar, novo conteúdo esperado."}

## Regras
- NUNCA gere código agora — apenas planeje e descreva com precisão
- Faça perguntas de esclarecimento se necessário
- O "refined_prompt" deve ser preciso o suficiente para um agente aplicar sem ambiguidade
- Baseie-se sempre no código real fornecido abaixo para referenciar arquivos e trechos

## Código-fonte do projeto
"""

_CHAT_KEYWORD_MAP: dict[str, list[str]] = {
    "dashboard": ["dashboard", "home", "index"],
    "sidebar": ["layout", "sidebar", "compact", "wide"],
    "perfil": ["profile", "settings", "auth"],
    "configurações": ["settings", "config"],
    "busca": ["search", "agent"],
    "produto": ["product", "catalog"],
    "fornecedor": ["supplier"],
    "resultado": ["result"],
    "salvas": ["save", "saved"],
    "login": ["login", "auth"],
    "feedback": ["feedback", "ticket"],
    "layout": ["layout", "compact", "wide", "minimal"],
    "botão": ["button", "component"],
    "modal": ["modal", "dialog"],
    "menu": ["nav", "menu", "layout"],
    "header": ["header", "banner", "layout"],
    "cor": ["theme", "color", "style"],
    "tema": ["theme", "color"],
    "ícone": ["icon", "lucide"],
}


def _collect_chat_context(prompt: str, ticket_desc: str = "") -> str:
    """Lê conteúdo real dos arquivos para o agente de chat (contexto mais amplo)."""
    combined = (prompt + " " + ticket_desc).lower()

    keywords: set[str] = set()
    for word in combined.split():
        w = word.strip(".,!?():;\"'")
        keywords.add(w)
        for pt_key, en_vals in _CHAT_KEYWORD_MAP.items():
            if pt_key in w or w in pt_key:
                keywords.update(en_vals)

    frontend_src = PROJECT_ROOT / "frontend" / "src"

    core_rels = [
        "frontend/src/layouts/CompactLayout.tsx",
        "frontend/src/layouts/WideLayout.tsx",
        "frontend/src/layouts/LayoutSelector.tsx",
    ]

    try:
        all_ts: list[Path] = list(frontend_src.rglob("*.tsx")) + list(frontend_src.rglob("*.ts"))
    except Exception:
        all_ts = []

    core_names = {Path(r).name for r in core_rels}
    scored: list[tuple[int, Path]] = []
    for p in all_ts:
        if p.name in core_names:
            continue
        rel_lower = p.relative_to(PROJECT_ROOT).as_posix().lower()
        score = sum(1 for kw in keywords if kw in rel_lower)
        if score > 0:
            scored.append((score, p))
    scored.sort(key=lambda x: -x[0])

    tree_lines = sorted(p.relative_to(PROJECT_ROOT).as_posix() for p in all_ts)[:80]
    parts: list[str] = ["### Árvore de arquivos (frontend/src)\n" + "\n".join(tree_lines)]

    read_pairs: list[tuple[str, Path]] = [
        (r, PROJECT_ROOT / Path(r)) for r in core_rels
    ]
    seen_paths = {str(p) for _, p in read_pairs}
    for _, p in scored[:4]:
        sp = str(p)
        if sp not in seen_paths:
            rel = p.relative_to(PROJECT_ROOT).as_posix()
            read_pairs.append((rel, p))
            seen_paths.add(sp)

    MAX_PER = 4_000
    MAX_TOTAL = 20_000
    total = 0

    for rel, fp in read_pairs:
        try:
            content = fp.read_text(encoding="utf-8")
            if len(content) > MAX_PER:
                content = content[:MAX_PER] + "\n... [arquivo truncado]"
            parts.append(f"### {rel}\n```\n{content}\n```")
            total += len(content)
            if total >= MAX_TOTAL:
                break
        except Exception:
            pass

    return "\n\n".join(parts)


def _extract_chat_result(raw: str) -> dict:
    result = _extract_json(raw)
    if "text" not in result:
        result["text"] = raw[:500]
    result.setdefault("refined_prompt", None)
    return result


def _claude_chat_sync(api_key: str, system: str, messages: list[dict]) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=4096, system=system, messages=messages,
    )
    return _extract_chat_result(resp.content[0].text)


def _gemini_chat_sync(api_key: str, system: str, messages: list[dict]) -> dict:
    import urllib.request, urllib.error
    contents = []
    for i, m in enumerate(messages):
        role = "user" if m["role"] == "user" else "model"
        text = m["content"]
        if i == 0 and role == "user":
            text = f"{system}\n\n---\n\n{text}"
        contents.append({"role": role, "parts": [{"text": text}]})
    payload = json.dumps({
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
    }).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")
        raise RuntimeError(f"Gemini API {e.code}: {detail[:200]}")
    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    return _extract_chat_result(raw)


def _groq_chat_sync(api_key: str, system: str, messages: list[dict]) -> dict:
    import urllib.request, urllib.error
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "system", "content": system}] + messages,
        "temperature": 0.3, "max_tokens": 4096,
    }).encode()
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions", data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "groq-python/0.9.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")
        raise RuntimeError(f"Groq API {e.code}: {detail[:200]}")
    return _extract_chat_result(data["choices"][0]["message"]["content"])


def _perplexity_chat_sync(api_key: str, system: str, messages: list[dict]) -> dict:
    import urllib.request, urllib.error
    payload = json.dumps({
        "model": "llama-3.1-sonar-large-128k-online",
        "messages": [{"role": "system", "content": system}] + messages,
        "temperature": 0.3, "max_tokens": 4096,
    }).encode()
    req = urllib.request.Request(
        "https://api.perplexity.ai/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")
        raise RuntimeError(f"Perplexity API {e.code}: {detail[:200]}")
    return _extract_chat_result(data["choices"][0]["message"]["content"])


async def chat_agent_execute(message: str, history: list[dict], ticket_context: str) -> dict:
    """Chat de planejamento com acesso completo ao código. Retorna {text, refined_prompt}."""
    import asyncio as _asyncio
    from app.config import settings

    codebase = await _asyncio.to_thread(_collect_chat_context, message, ticket_context)
    system = _CHAT_SYSTEM + codebase
    messages = history[-10:] if len(history) > 10 else list(history)

    providers = []
    if (settings.GROQ_API_KEY or "").strip():
        providers.append(("Groq", _groq_chat_sync, settings.GROQ_API_KEY))
    if (settings.GEMINI_API_KEY or "").strip():
        providers.append(("Gemini", _gemini_chat_sync, settings.GEMINI_API_KEY))

    if not providers:
        raise RuntimeError("Nenhum provider configurado — adicione GROQ_API_KEY ou GEMINI_API_KEY")

    errors: list[str] = []
    for name, fn, key in providers:
        try:
            logger.info("chat_agent: chamando %s…", name)
            return await _asyncio.to_thread(fn, key.strip(), system, messages)
        except Exception as exc:
            msg = f"{name}: {exc}"
            logger.warning("chat_agent: %s falhou — %s", name, exc)
            errors.append(msg)
    raise RuntimeError("Todos os providers falharam — " + " | ".join(errors))
