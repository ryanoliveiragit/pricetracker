"""
Análise de feedback — classifica qualquer tipo de feedback do usuário e gera
um prompt de desenvolvimento pronto para implementar a correção.

Providers: Groq (GROQ_API_KEY) → Ollama → heurística.
"""
from __future__ import annotations

import json
import logging
import os
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — genérico para qualquer tipo de feedback
# ---------------------------------------------------------------------------

_SYSTEM = """Você é analista de produto do ConstruPrice — sistema de busca de materiais de construção brasileiro.

Analise o feedback do usuário e classifique em uma das categorias:
- "add_abbreviation": problema de busca onde um termo curto não encontra o produto (ex: "cad" não acha "cadeado")
- "add_synonym":      problema de busca onde palavras equivalentes não se encontram (ex: "cola" não acha "adesivo")
- "ui_change":        melhoria de interface, layout ou experiência visual
- "feature_request":  pedido de funcionalidade nova
- "bug_fix":          erro ou comportamento incorreto no sistema
- "no_fix_needed":    elogio, dúvida ou não requer ação

Retorne APENAS JSON válido (sem markdown), com esta estrutura:

{
  "summary": "frase curta descrevendo o pedido",
  "fix_type": "add_abbreviation | add_synonym | ui_change | feature_request | bug_fix | no_fix_needed",
  "can_auto_fix": false,
  "proposed_fix": {
    "prompt": "Prompt completo e detalhado para um desenvolvedor implementar essa mudança. Deve conter: o que mudar, onde (componente/arquivo se souber), comportamento esperado. Seja específico e técnico."
  },
  "confidence": 0.85,
  "explanation": "por que essa classificação e esse prompt resolvem o pedido"
}

Para add_abbreviation: can_auto_fix=true, proposed_fix={"long_form":"...","short_forms":["..."]}
Para add_synonym:      can_auto_fix=true, proposed_fix={"group":["termo1","termo2"]}
Para demais tipos:     can_auto_fix=false, proposed_fix={"prompt":"..."}
Para no_fix_needed:    can_auto_fix=false, proposed_fix={}"""


# ---------------------------------------------------------------------------
# Helpers para construir a mensagem do usuário
# ---------------------------------------------------------------------------

_PROBLEM_TYPE_HINT = {
    "search":     "O usuário classificou como PROBLEMA DE BUSCA (abreviação ou sinônimo não mapeado).",
    "ui":         "O usuário classificou como PROBLEMA DE INTERFACE/VISUAL (layout, cores, tema, legibilidade).",
    "bug":        "O usuário classificou como BUG/ERRO (comportamento incorreto ou quebrado).",
    "suggestion": "O usuário classificou como SUGESTÃO DE FUNCIONALIDADE (nova feature ou melhoria).",
}


def _build_user_msg(problem_type: str, search_query: str, expected_result: str, description: str) -> str:
    parts = []
    hint = _PROBLEM_TYPE_HINT.get(problem_type)
    if hint:
        parts.append(f"Categoria informada pelo usuário: {hint}")
    if search_query:
        parts.append(f"Busca realizada: {search_query}")
    if expected_result:
        parts.append(f"Resultado esperado: {expected_result}")
    parts.append(f"Feedback do usuário: {description}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Provider: Groq
# ---------------------------------------------------------------------------

def _groq_analyze_sync(api_key: str, user_msg: str) -> dict:
    import urllib.error
    import urllib.request

    payload = json.dumps({
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        "max_tokens": 512,
        "temperature": 0.2,
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
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")
        try:
            detail = json.loads(detail).get("error", {}).get("message", detail)
        except Exception:
            pass
        raise RuntimeError(f"Groq {e.code}: {detail}")

    raw = body["choices"][0]["message"]["content"].strip()
    # extrai primeiro objeto JSON balanceado
    start = raw.find("{")
    if start != -1:
        depth, end = 0, -1
        for i, ch in enumerate(raw[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end != -1:
            return json.loads(raw[start:end + 1])
    raise ValueError(f"Resposta da IA não contém JSON válido: {raw[:200]}")


async def _groq_analyze(api_key: str, problem_type: str, search_query: str, expected_result: str, description: str) -> dict:
    import asyncio
    user_msg = _build_user_msg(problem_type, search_query, expected_result, description)
    return await asyncio.to_thread(_groq_analyze_sync, api_key, user_msg)


# ---------------------------------------------------------------------------
# Provider: Gemini (free tier — gemini-2.0-flash)
# ---------------------------------------------------------------------------

def _gemini_analyze_sync(api_key: str, user_msg: str) -> dict:
    import urllib.request, urllib.error
    payload = json.dumps({
        "systemInstruction": {"parts": [{"text": _SYSTEM}]},
        "contents": [{"parts": [{"text": user_msg}]}],
        "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.2},
    }).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
        data=payload, headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini {e.code}: {e.read().decode(errors='ignore')[:200]}")
    raw = body["candidates"][0]["content"]["parts"][0]["text"].strip()
    start = raw.find("{")
    if start != -1:
        depth, in_str, esc = 0, False, False
        for i, ch in enumerate(raw[start:], start):
            if esc: esc = False
            elif ch == "\\" and in_str: esc = True
            elif ch == '"': in_str = not in_str
            elif not in_str:
                if ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(raw[start:i + 1])
    raise ValueError(f"Gemini: JSON inválido: {raw[:200]}")


async def _gemini_analyze(api_key: str, problem_type: str, search_query: str, expected_result: str, description: str) -> dict:
    import asyncio
    user_msg = _build_user_msg(problem_type, search_query, expected_result, description)
    return await asyncio.to_thread(_gemini_analyze_sync, api_key, user_msg)


# ---------------------------------------------------------------------------
# Provider: Perplexity
# ---------------------------------------------------------------------------

def _perplexity_analyze_sync(api_key: str, user_msg: str) -> dict:
    import urllib.request, urllib.error
    payload = json.dumps({
        "model": "sonar",
        "messages": [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user_msg}],
        "max_tokens": 1024, "temperature": 0.2,
    }).encode()
    req = urllib.request.Request(
        "https://api.perplexity.ai/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Perplexity {e.code}: {e.read().decode(errors='ignore')[:200]}")
    raw = body["choices"][0]["message"]["content"].strip()
    start = raw.find("{")
    if start != -1:
        depth, in_str, esc = 0, False, False
        for i, ch in enumerate(raw[start:], start):
            if esc: esc = False
            elif ch == "\\" and in_str: esc = True
            elif ch == '"': in_str = not in_str
            elif not in_str:
                if ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(raw[start:i + 1])
    raise ValueError(f"Perplexity: JSON inválido: {raw[:200]}")


async def _perplexity_analyze(api_key: str, problem_type: str, search_query: str, expected_result: str, description: str) -> dict:
    import asyncio
    user_msg = _build_user_msg(problem_type, search_query, expected_result, description)
    return await asyncio.to_thread(_perplexity_analyze_sync, api_key, user_msg)


# ---------------------------------------------------------------------------
# Provider: Ollama
# ---------------------------------------------------------------------------

def _ollama_analyze_sync(base_url: str, model: str, user_msg: str) -> dict:
    import urllib.request

    payload = json.dumps({
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
    }).encode()

    req = urllib.request.Request(
        f"{base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())

    raw = body["message"]["content"].strip()
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()
    return json.loads(raw)


def _ollama_reachable_sync(base_url: str) -> bool:
    import urllib.request
    try:
        urllib.request.urlopen(f"{base_url}/api/tags", timeout=3)
        return True
    except Exception:
        return False


async def _ollama_analyze(base_url: str, model: str, problem_type: str, search_query: str, expected_result: str, description: str) -> dict:
    import asyncio
    user_msg = _build_user_msg(problem_type, search_query, expected_result, description)
    return await asyncio.to_thread(_ollama_analyze_sync, base_url, model, user_msg)


# ---------------------------------------------------------------------------
# Heurística — fallback sem dependências externas
# ---------------------------------------------------------------------------

_ABBREV_PATTERNS = [
    r"abreviam?\s+['\"]?(\w[\w\s\.]{1,40})['\"]?",
    r"listado\s+como\s+['\"]?(\w[\w\s\.]{1,40})['\"]?",
    r"aparece\s+como\s+['\"]?(\w[\w\s\.]{1,40})['\"]?",
    r"chama[- ]se\s+['\"]?(\w[\w\s\.]{1,40})['\"]?",
    r"cadastrado\s+como\s+['\"]?(\w[\w\s\.]{1,40})['\"]?",
]

_SYNONYM_PATTERNS = [
    r"sin[oô]nimo\s+de\s+['\"]?(\w[\w\s]{1,40})['\"]?",
    r"mesmo\s+que\s+['\"]?(\w[\w\s]{1,40})['\"]?",
    r"equivale?\s+a\s+['\"]?(\w[\w\s]{1,40})['\"]?",
]

_UI_KEYWORDS = [
    "tela", "botão", "menu", "layout", "interface", "cor", "fonte", "ícone",
    "dropdown", "modal", "sidebar", "navbar", "topbar", "perfil", "avatar",
    "coluna", "tabela", "card", "design", "visual", "aparência", "exibir",
    "mostrar", "ocultar", "mover", "reorganizar", "agrupar", "colocar",
]

_FEATURE_KEYWORDS = [
    "adicionar", "criar", "implementar", "incluir", "permitir", "possibilitar",
    "gostaria", "seria legal", "poderia ter", "falta", "faltando", "quero",
    "funcionalidade", "recurso", "opção", "feature",
]

_BUG_KEYWORDS = [
    "erro", "bug", "falha", "quebrado", "não funciona", "não carrega",
    "travado", "lento", "incorreto", "errado", "problema", "crash",
]


def _heuristic(problem_type: str, search_query: str, expected_result: str, description: str) -> dict:
    q = (search_query or "").strip().lower()
    exp = (expected_result or "").strip().lower()
    desc = (description or "").strip()
    desc_lower = desc.lower()

    # ── Bypass por tipo declarado pelo usuário ─────────────────────────────
    if problem_type == "ui":
        return {
            "summary": f"Interface: {desc[:80]}",
            "fix_type": "ui_change",
            "can_auto_fix": False,
            "proposed_fix": {
                "prompt": (
                    f"Implemente a seguinte melhoria de interface solicitada por um usuário:\n\n"
                    f"\"{desc}\"\n\n"
                    f"Identifique o(s) componente(s) afetado(s) no frontend "
                    f"(src/components/, src/layouts/, src/views/). "
                    f"Mantenha o padrão de design existente (Tailwind CSS, suporte a dark mode)."
                )
            },
            "confidence": 0.80,
            "explanation": "Usuário classificou explicitamente como problema de interface.",
        }

    if problem_type == "bug":
        return {
            "summary": f"Bug: {desc[:80]}",
            "fix_type": "bug_fix",
            "can_auto_fix": False,
            "proposed_fix": {
                "prompt": (
                    f"Investigue e corrija o seguinte bug reportado por um usuário:\n\n"
                    f"\"{desc}\"\n\n"
                    + (f"Contexto de busca: '{q}'\n" if q else "")
                    + "Verifique logs do backend (FastAPI) e o comportamento no frontend (Next.js). "
                    "Adicione tratamento de erro adequado se necessário."
                )
            },
            "confidence": 0.80,
            "explanation": "Usuário classificou explicitamente como bug.",
        }

    if problem_type == "suggestion":
        return {
            "summary": f"Sugestão: {desc[:80]}",
            "fix_type": "feature_request",
            "can_auto_fix": False,
            "proposed_fix": {
                "prompt": (
                    f"Implemente a seguinte funcionalidade sugerida por um usuário:\n\n"
                    f"\"{desc}\"\n\n"
                    f"Avalie o impacto no backend (FastAPI/Python) e no frontend (Next.js/React/TypeScript). "
                    f"Siga os padrões existentes do projeto."
                )
            },
            "confidence": 0.80,
            "explanation": "Usuário classificou explicitamente como sugestão de funcionalidade.",
        }

    # ── Abreviação de busca ────────────────────────────────────────────────
    is_short_query = 0 < len(q.replace(" ", "")) <= 5
    long_from_desc: str | None = None
    for pat in _ABBREV_PATTERNS:
        m = re.search(pat, desc_lower)
        if m:
            long_from_desc = m.group(1).strip()
            break

    if q and exp and len(exp) > len(q) + 2:
        return {
            "summary": f"'{q}' não encontra '{exp}' — abreviação não mapeada",
            "fix_type": "add_abbreviation",
            "can_auto_fix": True,
            "proposed_fix": {"long_form": exp, "short_forms": [q]},
            "confidence": 0.78,
            "explanation": f"Busca '{q}' é mais curta que o resultado esperado '{exp}'. Cadastrar esse par resolve.",
        }

    if is_short_query and long_from_desc:
        return {
            "summary": f"'{q}' é abreviação de '{long_from_desc}' — par não mapeado",
            "fix_type": "add_abbreviation",
            "can_auto_fix": True,
            "proposed_fix": {"long_form": long_from_desc, "short_forms": [q]},
            "confidence": 0.72,
            "explanation": f"Query curta '{q}' detectada. Descrição menciona '{long_from_desc}' como forma longa.",
        }

    # ── Sinônimo de busca ──────────────────────────────────────────────────
    for pat in _SYNONYM_PATTERNS:
        m = re.search(pat, desc_lower)
        if m and q:
            group_term = m.group(1).strip()
            return {
                "summary": f"'{q}' e '{group_term}' não mapeados como sinônimos",
                "fix_type": "add_synonym",
                "can_auto_fix": True,
                "proposed_fix": {"group": [q, group_term]},
                "confidence": 0.65,
                "explanation": f"Descrição sugere equivalência entre '{q}' e '{group_term}'.",
            }

    # ── UI / layout ────────────────────────────────────────────────────────
    ui_hits = sum(1 for kw in _UI_KEYWORDS if kw in desc_lower)
    if ui_hits >= 2:
        return {
            "summary": f"Melhoria de interface: {desc[:80]}",
            "fix_type": "ui_change",
            "can_auto_fix": False,
            "proposed_fix": {
                "prompt": (
                    f"Implemente a seguinte melhoria de interface solicitada por um usuário:\n\n"
                    f"\"{desc}\"\n\n"
                    f"Identifique o(s) componente(s) afetado(s) no frontend (src/components/, src/layouts/, src/views/), "
                    f"faça a alteração visual/estrutural mantendo o padrão de design existente (Tailwind CSS, dark mode)."
                )
            },
            "confidence": 0.60,
            "explanation": "Feedback contém múltiplas referências a elementos de interface.",
        }

    # ── Feature request ────────────────────────────────────────────────────
    feat_hits = sum(1 for kw in _FEATURE_KEYWORDS if kw in desc_lower)
    if feat_hits >= 1:
        return {
            "summary": f"Nova funcionalidade: {desc[:80]}",
            "fix_type": "feature_request",
            "can_auto_fix": False,
            "proposed_fix": {
                "prompt": (
                    f"Implemente a seguinte funcionalidade solicitada por um usuário:\n\n"
                    f"\"{desc}\"\n\n"
                    f"Avalie o impacto no backend (FastAPI) e frontend (Next.js/React). "
                    f"Siga os padrões existentes do projeto."
                )
            },
            "confidence": 0.55,
            "explanation": "Feedback indica pedido de nova funcionalidade.",
        }

    # ── Bug ────────────────────────────────────────────────────────────────
    bug_hits = sum(1 for kw in _BUG_KEYWORDS if kw in desc_lower)
    if bug_hits >= 1:
        return {
            "summary": f"Bug reportado: {desc[:80]}",
            "fix_type": "bug_fix",
            "can_auto_fix": False,
            "proposed_fix": {
                "prompt": (
                    f"Investigue e corrija o seguinte bug reportado por um usuário:\n\n"
                    f"\"{desc}\"\n\n"
                    + (f"Contexto: busca por '{q}'" if q else "")
                    + "\n\nVerifique logs do backend e o comportamento no frontend."
                )
            },
            "confidence": 0.55,
            "explanation": "Feedback descreve um comportamento incorreto ou erro.",
        }

    # ── Fallback genérico ──────────────────────────────────────────────────
    prompt = f"Avalie e implemente a seguinte solicitação de usuário:\n\n\"{desc}\""
    if q:
        prompt += f"\n\nContexto de busca: '{q}'"
    if exp:
        prompt += f"\nResultado esperado: '{exp}'"

    return {
        "summary": desc[:100] if desc else "Feedback sem classificação",
        "fix_type": "feature_request",
        "can_auto_fix": False,
        "proposed_fix": {"prompt": prompt},
        "confidence": 0.3,
        "explanation": "Não foi possível classificar automaticamente. Prompt genérico gerado para análise manual.",
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def analyze_feedback(
    problem_type: str,
    search_query: str,
    expected_result: str,
    description: str,
    screenshot_path: str | None = None,
) -> dict:
    """Tenta Gemini → Perplexity → Groq → Ollama → heurística. Nunca lança exceção."""
    from app.config import settings

    ai_providers = []
    if (settings.GEMINI_API_KEY or "").strip():
        ai_providers.append(("Gemini",      _gemini_analyze,      settings.GEMINI_API_KEY.strip()))
    if (settings.PERPLEXITY_API_KEY or "").strip():
        ai_providers.append(("Perplexity",  _perplexity_analyze,  settings.PERPLEXITY_API_KEY.strip()))
    if (settings.GROQ_API_KEY or "").strip():
        ai_providers.append(("Groq",        _groq_analyze,        settings.GROQ_API_KEY.strip()))

    for name, fn, key in ai_providers:
        logger.info("feedback_agent: chamando %s…", name)
        try:
            result = await fn(key, problem_type, search_query, expected_result, description)
            logger.info("feedback_agent: %s respondeu", name)
            return result
        except Exception as exc:
            logger.warning("feedback_agent: %s falhou — %s", name, exc)

    groq_key = ""  # already tried above

    ollama_url = settings.OLLAMA_URL.strip()
    ollama_model = settings.OLLAMA_MODEL.strip()
    try:
        import asyncio
        if await asyncio.to_thread(_ollama_reachable_sync, ollama_url):
            result = await _ollama_analyze(ollama_url, ollama_model, problem_type, search_query, expected_result, description)
            logger.info(f"feedback_agent: análise via Ollama ({ollama_model})")
            return result
    except Exception as exc:
        logger.info(f"feedback_agent: Ollama indisponível — {exc}")

    result = _heuristic(problem_type, search_query, expected_result, description)
    logger.info("feedback_agent: análise via heurística")
    return result
