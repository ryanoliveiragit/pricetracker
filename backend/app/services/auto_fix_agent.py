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


def _repair_json(s: str) -> str:
    """
    Repara JSON com aspas duplas e/ou newlines literais dentro de string values.
    - Aspas internas: se não seguidas de ,  }  ]  :  → escapa como \"
    - Newlines/tabs literais dentro de strings → escapa como \\n / \\t
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
                    out.append('\\"')
        elif in_str and c == "\n":
            out.append("\\n")
        elif in_str and c == "\r":
            pass  # ignora \r sozinho
        elif in_str and c == "\t":
            out.append("\\t")
        else:
            out.append(c)
        i += 1
    return "".join(out)


# mantém alias para não quebrar chamadas existentes
_fix_unescaped_quotes = _repair_json


def _extract_json(raw: str) -> dict:
    """Extrai JSON de uma resposta que pode ter markdown ou texto ao redor."""

    def _try(s: str) -> dict | None:
        try:
            return json.loads(s)
        except Exception:
            return None

    repaired = _repair_json(raw)

    # 1. json.loads direto (original e reparado)
    r = _try(raw) or _try(repaired)
    if r is not None:
        return r

    # 2. bloco ```json ... ```
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        content = m.group(1)
        r = _try(content) or _try(_repair_json(content))
        if r is not None:
            return r

    # 3. encontra { ... } externo respeitando strings
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
                        r = _try(fragment) or _try(_repair_json(fragment))
                        if r is not None:
                            return r
                        break

    # 4. último recurso: repair do repaired inteiro
    r = _try(repaired)
    if r is not None:
        return r

    logger.error("auto_fix_agent: resposta bruta não contém JSON válido:\n%s", raw)
    raise ValueError(f"Resposta da IA não contém JSON válido: {raw[:200]}")

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent  # raiz do projeto

_SYSTEM = """Você é um desenvolvedor sênior implementando uma mudança no projeto PriceTracker.

Stack:
- Backend: Python/FastAPI em backend/
- Frontend: Next.js 14 / TypeScript / Tailwind CSS em frontend/src/

Você receberá:
1. A solicitação de mudança
2. Conteúdo dos arquivos relevantes

Retorne APENAS JSON válido (sem markdown):
{
  "changes": [
    {
      "file": "caminho/relativo/ao/projeto",
      "old": "trecho EXATO do arquivo a substituir",
      "new": "novo conteúdo que substitui o trecho"
    }
  ],
  "summary": "descrição curta"
}

REGRAS CRÍTICAS — LEIA COM ATENÇÃO:
1. "old" e "new" são SEMPRE strings JSON — NUNCA arrays, NUNCA objetos, APENAS texto entre aspas
2. "old" DEVE existir textualmente no arquivo — copie caractere por caractere, incluindo indentação
3. "old" deve ser ÚNICO no arquivo (sem duplicatas)
4. Multi-linha em "new": use \\n para quebra de linha, \\t ou espaços para indentação
5. Aspas duplas dentro do texto: escape como \\" dentro da string JSON
6. Máximo de 3 changes por resposta
7. NUNCA modifique: layout.tsx, providers.tsx, _app.tsx

ESTRATÉGIA:
- Trocar texto/classe → "old": "text-blue-500"  →  "new": "text-green-500"
- Trocar import      → "old": "LogOut"          →  "new": "LogOut, User"
- Adicionar estado   → "old": "const pathname"  →  "new": "const [open, setOpen] = useState(false);\\n  const pathname"
- Substituir bloco JSX inteiro → copie o bloco original em "old" e ponha o novo em "new"

ERRO COMUM — NUNCA FAÇA:
  "old": [{ href: "/", icon: Home }]   ← ERRADO: array não é string
  "old": { href: "/", icon: Home }     ← ERRADO: objeto não é string

CORRETO:
  "old": "{ href: \\"/\\", icon: Home, label: \\"Dashboard\\" },"

Se não precisar alterar nada: {"changes": [], "summary": "Sem mudanças necessárias"}"""


# ---------------------------------------------------------------------------
# Seleção de arquivos de contexto por fix_type
# ---------------------------------------------------------------------------

_CONTEXT_GLOBS: dict[str, list[str]] = {
    "ui_change": [
        "frontend/src/app/(protected)/**/*.tsx",
        "frontend/src/layouts/*.tsx",
        "frontend/src/components/*.tsx",
    ],
    "feature_request": [
        "frontend/src/app/(protected)/**/*.tsx",
        "frontend/src/layouts/*.tsx",
        "backend/app/api/routes/*.py",
    ],
    "bug_fix": [
        "backend/app/api/routes/*.py",
        "backend/app/services/*.py",
        "frontend/src/services/*.ts",
    ],
}

MAX_FILE_CHARS = 10_000  # ~250 linhas médias
MAX_FILES = 2

# Mapeia termos do domínio (PT + EN) para nomes de arquivo/path
_KEYWORD_HINTS: dict[str, list[str]] = {
    "configurações": ["settings"],
    "configuracao":  ["settings"],
    "perfil":        ["settings", "profile"],
    "profile":       ["settings", "profile"],
    "settings":      ["settings"],
    "fornecedor":    ["supplier", "suppliers"],
    "supplier":      ["supplier", "suppliers"],
    "busca":         ["search"],
    "search":        ["search"],
    "produto":       ["product", "catalog"],
    "product":       ["product", "catalog"],
    "funcionário":   ["team", "users"],
    "funcionario":   ["team", "users"],
    "usuario":       ["settings", "users"],
    "resultado":     ["result", "results"],
    "result":        ["result", "results"],
    "salvo":         ["save", "saves"],
    "save":          ["save", "saves"],
    "agente":        ["agent"],
    "agent":         ["agent"],
    "login":         ["login", "auth"],
    "senha":         ["security", "auth"],
    "segurança":     ["security"],
    "layout":        ["layout", "compact", "sidebar", "topbar"],
    "sidebar":       ["sidebar"],
    "navbar":        ["sidebar", "topbar", "compact"],
    "menu":          ["sidebar", "topbar", "compact", "layout"],
    "botão":         ["layout", "settings"],
    "sair":          ["settings", "auth"],
    "logout":        ["settings", "auth"],
}


def _expand_keywords(prompt: str) -> list[str]:
    """Expande palavras do prompt PT/EN para termos que aparecem em paths de arquivo."""
    prompt_lower = prompt.lower()
    expanded: set[str] = set()
    # palavras brutas do prompt
    for w in prompt_lower.split():
        w = w.strip(".,;:!?\"'()")
        if len(w) > 3:
            expanded.add(w)
    # expansão via hints
    for term, hints in _KEYWORD_HINTS.items():
        if term in prompt_lower:
            expanded.update(hints)
    return list(expanded)


def _collect_context(fix_type: str, prompt: str) -> str:
    """Coleta arquivos relevantes. Envia arquivo completo se couber, senão a seção mais relevante."""
    import glob as _glob

    globs = _CONTEXT_GLOBS.get(fix_type, _CONTEXT_GLOBS["ui_change"])
    candidates: list[Path] = []
    for pattern in globs:
        full_pattern = str(PROJECT_ROOT / pattern)
        candidates.extend(Path(p) for p in _glob.glob(full_pattern, recursive=True))

    keywords = _expand_keywords(prompt)

    def score(p: Path) -> int:
        path_str = str(p).replace("\\", "/").lower()
        return sum(1 for kw in keywords if kw in path_str)

    candidates.sort(key=score, reverse=True)
    # nunca incluir arquivos de infraestrutura com score 0 quando há candidatos com score > 0
    top_score = score(candidates[0]) if candidates else 0
    if top_score > 0:
        candidates = [c for c in candidates if score(c) > 0]
    candidates = candidates[:MAX_FILES]

    parts: list[str] = []
    for path in candidates:
        try:
            content = path.read_text(encoding="utf-8")
            rel = path.relative_to(PROJECT_ROOT)

            if len(content) <= MAX_FILE_CHARS:
                parts.append(f"### {rel}\n```\n{content}\n```")
            else:
                # Localiza a seção mais próxima das palavras do prompt
                lines = content.splitlines()
                best_line, best_score_line = 0, 0
                for i, line in enumerate(lines):
                    ll = line.lower()
                    s = sum(1 for kw in keywords if kw in ll)
                    if s > best_score_line:
                        best_score_line, best_line = s, i
                start = max(0, best_line - 40)
                end = min(len(lines), best_line + 160)
                excerpt = "\n".join(lines[start:end])
                parts.append(f"### {rel} (linhas {start + 1}–{end})\n```\n{excerpt}\n```")
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

def _validate_result(result: dict) -> dict:
    """
    Garante que cada change tem 'old' e 'new' como strings.
    Remove changes malformados e loga aviso.
    """
    valid: list[dict] = []
    for c in result.get("changes", []):
        old, new = c.get("old", ""), c.get("new", "")
        if not isinstance(old, str) or not isinstance(new, str):
            logger.warning(
                "auto_fix_agent: change ignorado — 'old'/'new' não são strings. "
                "old type=%s, new type=%s, file=%s",
                type(old).__name__, type(new).__name__, c.get("file"),
            )
            continue
        valid.append(c)
    result["changes"] = valid
    return result


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
            result = _validate_result(result)
            logger.info("auto_fix_agent: %s respondeu:\n%s", name, json.dumps(result, ensure_ascii=False, indent=2))
            if not result.get("changes"):
                raise ValueError("IA retornou changes vazio ou malformado após validação")
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
    """Aplica mudanças nos arquivos. Tenta match exato, cai em fuzzy se falhar. Valida JSX após patch."""
    results = []
    for change in changes:
        file_path = PROJECT_ROOT / change["file"]
        old = change.get("old", "")
        new = change.get("new", "")
        try:
            content = file_path.read_text(encoding="utf-8")
            if old in content:
                patched = content.replace(old, new, 1)
            else:
                patched = _fuzzy_replace(content, old, new)
                if patched is None:
                    logger.warning("apply_changes: not_found em %s\nold=%r", change["file"], old[:120])
                    results.append({"file": change["file"], "status": "not_found",
                                    "error": "Trecho não encontrado (exact nem fuzzy)"})
                    continue

            # Valida JSX antes de gravar
            jsx_err = _post_validate_patch(file_path, patched)
            if jsx_err:
                logger.warning("apply_changes: patch rejeitado (%s) em %s", jsx_err, change["file"])
                results.append({"file": change["file"], "status": "error",
                                 "error": f"Patch rejeitado — {jsx_err}"})
                continue

            file_path.write_text(patched, encoding="utf-8")
            results.append({"file": change["file"], "status": "applied",
                             "method": "exact" if old in content else "fuzzy"})
        except Exception as e:
            results.append({"file": change["file"], "status": "error", "error": str(e)})
    return results


def _find_tsc(frontend_path: Path) -> str | None:
    """Localiza o binário tsc: local node_modules primeiro, depois npx."""
    import sys
    suffix = ".cmd" if sys.platform == "win32" else ""
    local = frontend_path / "node_modules" / ".bin" / f"tsc{suffix}"
    if local.exists():
        return str(local)
    import shutil
    return shutil.which("tsc") or shutil.which("npx")


def _check_jsx_balance(content: str) -> str | None:
    """
    Verifica desequilíbrio grosseiro de JSX/blocos em arquivos TSX.
    Retorna mensagem de erro ou None se OK.
    """
    opens  = content.count("{")
    closes = content.count("}")
    parens_o = content.count("(")
    parens_c = content.count(")")
    if abs(opens - closes) > 2:
        return f"chaves desequilibradas: {opens} '{{' vs {closes} '}}'"
    if abs(parens_o - parens_c) > 2:
        return f"parênteses desequilibrados: {parens_o} '(' vs {parens_c} ')'"
    return None


def pre_validate_changes(changes: list[dict]) -> list[str]:
    """
    Verifica se cada 'old' existe no arquivo antes de aplicar qualquer mudança.
    Retorna lista de erros (vazia = tudo OK).
    """
    errors: list[str] = []
    for change in changes:
        old = change.get("old", "")
        if not old:
            continue
        file_path = PROJECT_ROOT / change["file"]
        try:
            content = file_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            continue  # arquivo novo — OK
        if old in content:
            continue
        # tenta fuzzy
        if _fuzzy_replace(content, old, "", threshold=0.82) is not None:
            continue
        errors.append(
            f"{change['file']}: trecho não encontrado → '{old[:80]}'"
        )
    return errors


def _post_validate_patch(file_path: Path, new_content: str) -> str | None:
    """
    Após aplicar um patch, verifica se o arquivo TSX ficou sintaticamente razoável.
    Retorna mensagem de erro ou None se OK.
    """
    if not str(file_path).endswith((".tsx", ".ts", ".jsx", ".js")):
        return None
    return _check_jsx_balance(new_content)


def apply_and_validate(changes: list[dict]) -> tuple[list[dict], str | None]:
    """
    1. Pré-valida se os trechos 'old' existem nos arquivos.
    2. Aplica mudanças.
    3. Roda tsc --noEmit e reverte tudo se falhar.
    Retorna (results, error). error é None se passou.
    """
    import subprocess
    import sys

    frontend_path = PROJECT_ROOT / "frontend"

    # ── 0. Pré-validação (sem tocar nos arquivos) ────────────────────────────
    pre_errors = pre_validate_changes(changes)
    if pre_errors:
        dummy = [{"file": c["file"], "status": "not_found", "error": e}
                 for c, e in zip(changes, pre_errors)]
        return dummy, "Pré-validação falhou — nenhum arquivo foi alterado:\n" + "\n".join(pre_errors)

    # ── helpers ──────────────────────────────────────────────────────────────
    originals: dict[str, str | None] = {}
    for change in changes:
        fp = PROJECT_ROOT / change["file"]
        try:
            originals[change["file"]] = fp.read_text(encoding="utf-8")
        except FileNotFoundError:
            originals[change["file"]] = None

    def _revert() -> None:
        for file, original in originals.items():
            if original is not None:
                (PROJECT_ROOT / file).write_text(original, encoding="utf-8")

    def _run(cmd: list[str] | str, label: str, timeout: int = 120) -> str | None:
        try:
            proc = subprocess.run(
                cmd, cwd=str(frontend_path), capture_output=True,
                text=True, timeout=timeout,
                shell=isinstance(cmd, str) and sys.platform == "win32",
            )
            if proc.returncode != 0:
                out = (proc.stdout + proc.stderr).strip()[:800]
                logger.warning("auto_fix_agent: %s falhou:\n%s", label, out)
                return f"{label} falhou:\n{out}"
            logger.info("auto_fix_agent: %s passou ✅", label)
        except subprocess.TimeoutExpired:
            return f"{label} timeout"
        except FileNotFoundError as e:
            return f"{label} não encontrado ({e}) — instale Node.js e rode 'npm install' no frontend"
        return None

    # ── 1. Aplica ────────────────────────────────────────────────────────────
    results = apply_changes(changes)
    if any(r["status"] != "applied" for r in results):
        _revert()
        return results, "Nem todas as mudanças puderam ser aplicadas — revertido"

    # ── 2. Type-check ────────────────────────────────────────────────────────
    has_ts = any(
        c["file"].startswith("frontend/") and c["file"].endswith((".ts", ".tsx"))
        for c in changes
    )
    if not has_ts:
        logger.info("auto_fix_agent: sem arquivos TS — pulando tsc")
        return results, None

    tsc_bin = _find_tsc(frontend_path)
    if not tsc_bin:
        _revert()
        return results, "tsc não encontrado — instale Node.js e rode 'npm install' no frontend"

    tsc_cmd = [tsc_bin, "--noEmit"] if not tsc_bin.endswith("npx") else [tsc_bin, "tsc", "--noEmit"]
    err = _run(tsc_cmd, "tsc")
    if err:
        _revert()
        return results, f"Type-check falhou — mudanças revertidas:\n{err}"

    return results, None
