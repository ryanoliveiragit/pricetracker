"""
Sinônimos de materiais de construção em PT-BR.
Cada entrada mapeia um termo canônico para seus sinônimos.
A expansão é bidirecional: buscar "cola" também busca "adesivo" e vice-versa.
"""
from __future__ import annotations
from typing import Optional

from app.utils.text_normalizer import QUERY_STOP_WORDS, normalize_text

# Grupos de sinônimos — todos os termos do grupo são equivalentes
SYNONYM_GROUPS: list[list[str]] = [
    ["cola", "adesivo", "selante", "vedante", "silicone"],
    ["parafuso", "fixador", "prego", "bucha"],
    ["cimento", "cimento portland"],
    ["tinta", "pintura", "esmalte", "verniz"],
    ["argamassa", "massa", "reboco", "emboço"],
    ["tijolo", "bloco", "tijolinho"],
    ["telha", "telhado"],
    ["cano", "tubo", "tubulação"],
    ["registro", "válvula", "torneira"],
    ["fio", "cabo", "fio elétrico"],
    ["disjuntor", "chave", "interruptor automático"],
    ["lona", "manta", "plástico", "polietileno"],
    ["areia", "pó de pedra"],
    ["brita", "pedra", "pedra brita"],
    ["cal", "cal hidratada", "cal virgem"],
    ["impermeabilizante", "impermeabilização", "manta impermeável"],
    ["piso", "piso cerâmico", "porcelanato", "cerâmica"],
    ["rejunte", "rejuntamento", "rejuntador"],
    ["rodapé", "rodapé cerâmico"],
    ["gesso", "gesso acartonado", "drywall"],
    ["massa corrida", "massa fina", "massa PVA"],
    ["lixa", "papel lixa", "abrasivo"],
    ["escada", "escada de alumínio", "escada de madeira"],
    ["andaime", "cavalete"],
    ["cadeado", "cadeados", "fechadura"],
    ["dobradiça", "dobradiças", "articulação"],
    ["mola", "mola de porta", "mola hidráulica"],
    ["maçaneta", "puxador", "fechamento"],
    ["porta", "folha de porta"],
    ["janela", "esquadria", "janela de alumínio"],
    ["vidro", "vidraça"],
    ["sifão", "ralo", "grelha"],
    ["vaso", "vaso sanitário", "bacia sanitária"],
    ["pia", "cuba", "tanque"],
    ["chuveiro", "ducha", "misturador"],
    ["aquecedor", "boiler", "aquecedor de água"],
    ["interruptor", "tomada", "espelho"],
    ["quadro", "quadro elétrico", "caixa de distribuição"],
    ["extintor", "extintor de incêndio"],
    ["luva", "cotovelo", "joelho", "tê"],  # conexões hidráulicas
    ["redutor", "redução", "bucha de redução"],
    ["cap", "tampa", "plugue"],
    ["abraçadeira", "braçadeira", "clamp"],
]

# Índice invertido: termo → grupo de sinônimos
_INDEX: dict[str, list[str]] = {}
for group in SYNONYM_GROUPS:
    for term in group:
        _INDEX[term.lower()] = group


def expand_query_for_scrape(query: str, *, max_variants: int = 14) -> list[str]:
    """
    Gera termos a enviar aos scrapers.

    - Uma palavra em grupo de sinônimos: expande para todo o grupo (ex.: "cola").
    - Várias palavras: preserva âncoras (ex.: marca "tigre") e substitui só a
      primeira palavra que pertence a um grupo (ex.: "cola tigre" → também
      "adesivo tigre", "selante tigre", …) para achar "Adesivo PVC Tigre".
    """
    raw = (query or "").strip()
    if not raw:
        return []
    qn = normalize_text(raw)
    words = [w for w in qn.split() if w and len(w) >= 2 and w not in QUERY_STOP_WORDS]
    if not words:
        return [raw]

    out: list[str] = []
    seen: set[str] = set()

    def add(s: str) -> None:
        if len(out) >= max_variants:
            return
        t = s.strip()
        if not t:
            return
        k = normalize_text(t)
        if k not in seen:
            seen.add(k)
            out.append(t)

    if len(words) == 1:
        w0 = words[0]
        if w0 in _INDEX:
            for s in _INDEX[w0]:
                add(s)
        else:
            add(raw)
        return out

    add(raw)
    add(qn)
    if len(words) == 2:
        add(" ".join(reversed(words)))

    expand_idx = None
    for i, w in enumerate(words):
        if w in _INDEX:
            expand_idx = i
            break
    if expand_idx is None:
        return out[:max_variants]

    group = [
        s
        for s in _INDEX[words[expand_idx]]
        if " " not in s and len(s.strip()) >= 2
    ]
    for syn in group:
        subst = list(words)
        subst[expand_idx] = syn.strip().lower()
        add(" ".join(subst))

    return out[:max_variants]


def get_synonyms(query: str) -> list[str]:
    """
    Compatível com código legado: equivalente a ``expand_query_for_scrape``
    para uma única lista de termos.
    """
    return expand_query_for_scrape(query)


def canonical_for(query: str) -> str:
    """Retorna o primeiro (canônico) do grupo de sinônimos, ou a própria query."""
    q = query.strip().lower()
    if q in _INDEX:
        return _INDEX[q][0]
    return query
