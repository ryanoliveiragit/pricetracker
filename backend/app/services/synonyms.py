"""
Sinônimos de materiais de construção em PT-BR.
Cada entrada mapeia um termo canônico para seus sinônimos.
A expansão é bidirecional: buscar "cola" também busca "adesivo" e vice-versa.
"""
from __future__ import annotations
from typing import Optional

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


def get_synonyms(query: str) -> list[str]:
    """
    Retorna lista de termos de busca expandidos para uma query.
    Ex: "cola" → ["cola", "adesivo", "selante", "vedante", "silicone"]
    Se não há sinônimos, retorna [query].
    """
    q = query.strip().lower()
    # Busca exata
    if q in _INDEX:
        return list(_INDEX[q])
    # Busca parcial: verifica se alguma palavra da query bate com um sinônimo
    words = q.split()
    for word in words:
        if word in _INDEX:
            return [q] + [s for s in _INDEX[word] if s != word]
    return [query]


def canonical_for(query: str) -> str:
    """Retorna o primeiro (canônico) do grupo de sinônimos, ou a própria query."""
    q = query.strip().lower()
    if q in _INDEX:
        return _INDEX[q][0]
    return query
