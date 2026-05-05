"""
Relevância de busca: pontua ofertas com gate semântico por tipo de produto.

Regra central — a query tem uma âncora de *tipo de produto* (ex.: "cola"):
o resultado deve conter esse tipo ou um sinônimo direto ("adesivo", "selante"...)
para ser aceito. Isso descarta matches puramente por marca
(ex.: "cola tigre" × "ROLO ESPUMA CZ TIGRE" → rejeitado).
"""
from __future__ import annotations

import re
from typing import Any, List

from rapidfuzz import fuzz

from app.services.synonyms import _INDEX as _SYNONYM_INDEX
from app.utils.text_normalizer import QUERY_STOP_WORDS, normalize_text


def _key_tokens(q: str) -> list[str]:
    n = normalize_text(q)
    return [t for t in n.split() if len(t) >= 2 and t not in QUERY_STOP_WORDS]


def _token_word_match(token: str, text_norm: str) -> bool:
    return bool(
        re.search(r"(?<![a-z0-9])" + re.escape(token) + r"(?![a-z0-9])", text_norm)
    )


def _product_type_group(keys: list[str]) -> list[str] | None:
    """
    Primeiro token da query mapeado a um grupo de sinônimos = âncora de tipo.
    Ex.: ['cola','tigre'] → ['cola','adesivo','selante','vedante','silicone'].
    Retorna None quando a query é só marca ou nenhum token é tipo conhecido.
    """
    for t in keys:
        group = _SYNONYM_INDEX.get(t)
        if group:
            return [s.lower() for s in group]
    return None


def _any_term_in_text(terms: list[str], text_norm: str) -> bool:
    for term in terms:
        if " " in term:
            if term in text_norm:
                return True
        elif _token_word_match(term, text_norm):
            return True
    return False


def relevance_score(query: str, product_name: str) -> float:
    """
    Score 0–100: combina fuzzy ratios, cobertura dos tokens da query e bônus de frase.
    """
    q = normalize_text(query)
    p = normalize_text((product_name or "").lstrip("✓ "))
    if not q or not p:
        return 0.0

    keys = _key_tokens(q)

    # Gate semântico: se a query contém um tipo de produto (ex.: "cola"),
    # o produto DEVE conter esse tipo ou um sinônimo direto — bloqueia match só por marca.
    product_type = _product_type_group(keys)
    if product_type and not _any_term_in_text(product_type, p):
        return 0.0

    tsr = fuzz.token_set_ratio(q, p)
    tosr = fuzz.token_sort_ratio(q, p)
    par = fuzz.partial_ratio(q, p)
    wr = fuzz.WRatio(q, p)

    if keys:
        hits = sum(1 for t in keys if _token_word_match(t, p))
        token_cov = 100.0 * hits / len(keys)
        # Penaliza fortemente quando tokens-chave estão ausentes do nome do produto.
        coverage_multiplier = (hits / len(keys)) ** 1.5
    else:
        token_cov = 50.0
        coverage_multiplier = 1.0

    # Frase contínua (sem espaços) aparece no nome — forte para marcas compostas
    q_compact = q.replace(" ", "")
    p_compact = p.replace(" ", "")
    phrase_bonus = 12.0 if len(q_compact) >= 6 and q_compact in p_compact else 0.0

    base = 0.18 * tsr + 0.18 * tosr + 0.24 * par + 0.14 * wr + 0.26 * token_cov
    return min(100.0, round(base * coverage_multiplier + phrase_bonus, 2))


def rank_offers_by_query(
    query: str,
    offers: List[Any],
    *,
    max_results: int = 400,
) -> List[Any]:
    """
    Atribui ``offer.score``, ordena por relevância e descarta ruído com limiar adaptativo.
    """
    if not offers:
        return []

    scored: list[tuple[float, Any]] = []
    for offer in offers:
        name = (getattr(offer, "product_name", None) or "").lstrip("✓ ")
        s = relevance_score(query, name)
        offer.score = round(s, 2)
        scored.append((s, offer))

    scored.sort(
        key=lambda x: (
            -x[0],
            x[1].price if getattr(x[1], "price", 0) > 0 else float("inf"),
        )
    )
    best = scored[0][0]

    # Hard minimum: never return products with no relevance to the query
    ABS_MIN = 35.0
    if best < ABS_MIN:
        return []

    if best >= 85.0:
        thr = max(55.0, best * 0.60)
    elif best >= 65.0:
        thr = max(48.0, best * 0.58)
    elif best >= 50.0:
        thr = max(40.0, best * 0.72)
    else:  # 35–50: keep only near-peers of the best match
        thr = max(ABS_MIN, best * 0.88)

    chosen = [o for s, o in scored if s >= thr]
    # No fallback — if nothing meets the threshold, return nothing rather than garbage
    return chosen[:max_results]
