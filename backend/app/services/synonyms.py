"""
Sinônimos de materiais de construção em PT-BR.
Cada entrada mapeia um termo canônico para seus sinônimos.
A expansão é bidirecional: buscar "cola" também busca "adesivo" e vice-versa.
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Optional

from app.utils.text_normalizer import QUERY_STOP_WORDS, normalize_text


@lru_cache(maxsize=512)
def _word_boundary_pattern(term: str) -> re.Pattern:
    """Compila um padrão que casa ``term`` apenas como palavra(s) inteira(s).

    Evita que abreviações curtas (ex.: "ac" de "argamassa colante") sejam
    substituídas DENTRO de outra palavra ("acrilica" → "argamassa colante" +
    "rilica"), o que corrompia a query enviada aos scrapers.
    """
    return re.compile(
        r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])"
    )

# Grupos de sinônimos — todos os termos do grupo são equivalentes
SYNONYM_GROUPS: list[list[str]] = [  # <dynamic-synonyms-start>
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
    # <dynamic-synonyms-end>
]

# ---------------------------------------------------------------------------
# Abreviações bidirecionais de materiais de construção
# Mapa: forma longa → lista de formas curtas (e vice-versa no índice invertido)
# Usado por expand_query_for_scrape para gerar variantes abreviadas/por extenso
# ---------------------------------------------------------------------------
ABBREVIATION_PAIRS: list[tuple[str, list[str]]] = [  # <dynamic-abbreviations-start>
    # Hidráulica / louças
    ("caixa sifonada",    ["cx sif", "cx.sif", "caixa sif", "cx sifonada"]),
    ("caixa dagua",       ["cx agua", "caixa agua"]),
    ("vaso sanitario",    ["vaso san", "bacia sanitaria"]),
    ("caixa acoplada",    ["cx acoplada"]),
    ("caixa descarga",    ["cx descarga"]),
    ("joelho 90",         ["jo 90", "jol 90", "joelho 90 graus"]),
    ("joelho 45",         ["jo 45", "jol 45", "joelho 45 graus"]),
    ("tubo esgoto",       ["tb esgoto", "tub esgoto"]),
    ("tubo agua fria",    ["tb af", "tub af", "tubo af"]),
    ("tubo soldavel",     ["tb soldavel", "tub soldavel"]),
    ("registro gaveta",   ["reg gaveta"]),
    ("registro esfera",   ["reg esfera"]),
    ("sifao",             ["sif", "sifão"]),
    # Elétrica
    ("disjuntor",         ["disj", "dj"]),
    ("eletroduto",        ["eletrod", "conduit"]),
    ("cabo flexivel",     ["cabo flex", "cb flex"]),
    ("fio rigido",        ["fio rig"]),
    # Civil / alvenaria
    ("cimento portland",  ["cim portland", "cp ii", "cp iii", "cp iv", "cp v"]),
    ("argamassa colante", ["ac", "ac iii", "ac ii", "ac i"]),
    ("tijolo furado",     ["tj furado", "bloco furado"]),
    ("bloco concreto",    ["bl concreto", "bl cto"]),
    # Acabamento
    ("porcelanato",       ["porcel", "piso porcel"]),
    ("rejuntamento",      ["rejunte", "rejunt"]),
    ("massa corrida",     ["massa cor", "mc pva"]),
    # Ferragens
    ("parafuso cabeca",   ["par cab"]),
    ("bucha nylon",       ["bucha ny"]),
    ("chumbador",         ["chumb"]),
    ("cadeado",           ["cad", "cad."]),
    # <dynamic-abbreviations-end>
]

# Índice invertido de abreviações: forma_curta_normalizada → forma_longa
_ABBREV_INDEX: dict[str, str] = {}
for _long, _shorts in ABBREVIATION_PAIRS:
    _long_n = normalize_text(_long)
    for _short in _shorts:
        _short_n = normalize_text(_short)
        _ABBREV_INDEX[_short_n] = _long_n
    # também mapeia a forma longa para ela mesma (facilita lookup)
    _ABBREV_INDEX[_long_n] = _long_n

# Índice invertido: termo → grupo de sinônimos
_INDEX: dict[str, list[str]] = {}
for group in SYNONYM_GROUPS:
    for term in group:
        _INDEX[term.lower()] = group


def _abbrev_variants(query_normalized: str) -> list[str]:
    """
    Gera variantes abreviadas e por extenso de uma query normalizada.

    Estratégia:
    1. Tenta match exato da query inteira no índice de abreviações.
    2. Para cada par (longa→curtas), verifica se a forma longa está contida
       na query e gera versões com a forma curta no lugar.
    3. Faz o reverso: se a query contém uma forma curta, substitui pela longa.
    """
    variants: list[str] = []
    seen: set[str] = set()

    def add(s: str) -> None:
        s = s.strip()
        if s and s not in seen:
            seen.add(s)
            variants.append(s)

    # Match exato da query inteira
    if query_normalized in _ABBREV_INDEX:
        add(_ABBREV_INDEX[query_normalized])

    # Substituições por PALAVRA INTEIRA: forma longa → formas curtas.
    # (Usar limites de palavra evita corromper termos que apenas CONTÊM a
    #  forma como substring, ex.: "ac" dentro de "acrilica".)
    for long_form, shorts in ABBREVIATION_PAIRS:
        long_n = normalize_text(long_form)
        long_pat = _word_boundary_pattern(long_n)
        if long_pat.search(query_normalized):
            for short in shorts:
                short_n = normalize_text(short)
                add(long_pat.sub(short_n, query_normalized))

    # Substituições por PALAVRA INTEIRA: forma curta → forma longa (reverso)
    for long_form, shorts in ABBREVIATION_PAIRS:
        long_n = normalize_text(long_form)
        for short in shorts:
            short_n = normalize_text(short)
            if _word_boundary_pattern(short_n).search(query_normalized):
                add(_word_boundary_pattern(short_n).sub(long_n, query_normalized))

    return variants


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
        # Resolve abreviação primeiro (ex: "cad" → "cadeado")
        if w0 in _ABBREV_INDEX and _ABBREV_INDEX[w0] != w0:
            expanded = _ABBREV_INDEX[w0]
            add(expanded)
            if expanded in _INDEX:
                for s in _INDEX[expanded]:
                    add(s)
        elif w0 in _INDEX:
            for s in _INDEX[w0]:
                add(s)
        else:
            add(raw)
        return out

    add(raw)
    add(qn)
    if len(words) == 2:
        add(" ".join(reversed(words)))

    # Variantes de abreviação (ex: "caixa sifonada" → "cx sif", e vice-versa)
    for variant in _abbrev_variants(qn):
        add(variant)

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


def add_dynamic_abbreviation(long_form: str, short_forms: list[str]) -> None:
    """Adiciona par de abreviação dinamicamente (após aprovação de feedback)."""
    long_n = normalize_text(long_form)
    for short in short_forms:
        short_n = normalize_text(short)
        _ABBREV_INDEX[short_n] = long_n
    _ABBREV_INDEX[long_n] = long_n
    ABBREVIATION_PAIRS.append((long_form, short_forms))


def add_dynamic_synonym_group(group: list[str]) -> None:
    """Adiciona grupo de sinônimos dinamicamente (após aprovação de feedback)."""
    for term in group:
        _INDEX[term.lower()] = group
    SYNONYM_GROUPS.append(group)


def patch_synonyms_file(fix_type: str, data: dict) -> bool:
    """Escreve a correção diretamente em synonyms.py (fix permanente no código)."""
    file = Path(__file__)
    content = file.read_text(encoding="utf-8")

    if fix_type == "add_abbreviation":
        long_form = data.get("long_form", "").strip()
        short_forms = [s.strip() for s in data.get("short_forms", []) if s.strip()]
        if not long_form or not short_forms:
            return False
        new_line = f'    ("{long_form}",       {short_forms!r}),\n'
        marker = "    # <dynamic-abbreviations-end>"
        if marker not in content:
            return False
        content = content.replace(marker, new_line + marker)
        file.write_text(content, encoding="utf-8")
        return True

    if fix_type == "add_synonym":
        group = [t.strip() for t in data.get("group", []) if t.strip()]
        if len(group) < 2:
            return False
        new_line = f'    {group!r},\n'
        marker = "    # <dynamic-synonyms-end>"
        if marker not in content:
            return False
        content = content.replace(marker, new_line + marker)
        file.write_text(content, encoding="utf-8")
        return True

    return False


def load_dynamic_abbreviations(pairs: list[tuple[str, list[str]]]) -> None:
    """Carrega abreviações persistidas no DB durante startup."""
    for long_form, short_forms in pairs:
        add_dynamic_abbreviation(long_form, short_forms)


def load_dynamic_synonyms(groups: list[list[str]]) -> None:
    """Carrega grupos de sinônimos persistidos no DB durante startup."""
    for group in groups:
        add_dynamic_synonym_group(group)


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
