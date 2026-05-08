"""
Guided Search Agent for ConstruPrice.

This module implements a stateless, step-by-step search assistant that:
- detects products from free text
- asks the next most useful question
- returns structured UI metadata for chips/selects
- produces a final objective search summary when ready

Expected integration pattern:
- frontend sends the latest user message plus chat history
- backend rebuilds the state from the full conversation
- response includes the next step and available options

The agent never invents specifications not provided by the user.
"""

from __future__ import annotations

import re
from typing import Any, Optional

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

_ACCENT_MAP = str.maketrans(
    "ãâáàäêéèëîíìôóõöûúùüçñÃÂÁÀÄÊÉÈËÎÍÌÔÓÕÖÛÚÙÜÇÑ",
    "aaaaaeeeeiiioooouuuucnaaaaaeeeeiiioooouuuucn",
)


def normalize(text: str) -> str:
    return text.lower().translate(_ACCENT_MAP).strip()


def compact_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def title_case(text: str) -> str:
    if not text:
        return text
    return " ".join(part.capitalize() for part in text.split())


def option(label: str, value: Optional[str] = None) -> dict[str, str]:
    return {"label": label, "value": value or label}


def is_broad_answer(text: str) -> bool:
    norm = normalize(text)
    patterns = [
        r"\bqualquer\b",
        r"\btanto faz\b",
        r"\bnao sei\b",
        r"\bnao importa\b",
        r"\bsem preferencia\b",
        r"\bindiferente\b",
        r"\bpode ser qualquer\b",
        r"\bqualquer um\b",
        r"\bqualquer uma\b",
        r"\btodos os fornecedores\b",
        r"\btodo fornecedor\b",
    ]
    return any(re.search(pattern, norm) for pattern in patterns)


def unique_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = normalize(value)
        if key and key not in seen:
            seen.add(key)
            result.append(value)
    return result


# -----------------------------------------------------------------------------
# Product knowledge base
# -----------------------------------------------------------------------------

KNOWN_BRANDS = [
    "Votorantim",
    "Votoran",
    "Itambé",
    "Holcim",
    "Ciplan",
    "Cimpor",
    "Nassau",
    "Suvinil",
    "Coral",
    "Sherwin-Williams",
    "Renner",
    "Iquine",
    "Novacor",
    "Hydronorth",
    "Killing",
    "Lukscolor",
    "Tigre",
    "Amanco",
    "Krona",
    "Fortlev",
    "Gerdau",
    "Belgo",
    "ArcelorMittal",
    "Portobello",
    "Eliane",
    "Ceusa",
    "Eternit",
    "Brasilit",
    "Quartzolit",
    "Vedacit",
    "Sika",
    "Tekbond",
    "Cascola",
    "Pulvitec",
    "Votomassa",
    "Fortcola",
    "Steck",
    "Tramontina",
    "Schneider",
]

PRODUCT_KB: dict[str, dict[str, Any]] = {
    "cola": {
        "keywords": [
            "cola",
            "cola branca",
            "cola cinza",
            "cola ac1",
            "cola ac2",
            "cola ac3",
            "cola pvc",
            "cola instantanea",
            "cola instantânea",
            "cola de contato",
            "adesivo",
            "adesivo pvc",
            "adesivo plastico",
            "adesivo plástico",
        ],
        "display_name": "cola",
        "question_label": "cola",
        "fields": {
            "variant": {
                "question": "Qual tipo de cola você quer buscar?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("AC1"),
                    option("AC2"),
                    option("AC3"),
                    option("Cola branca"),
                    option("Cola cinza"),
                    option("Cola para porcelanato"),
                    option("Cola PVC"),
                    option("Cola instantânea"),
                    option("Cola de contato"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca você prefere?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Quartzolit"),
                    option("Vedacit"),
                    option("Sika"),
                    option("Tekbond"),
                    option("Cascola"),
                    option("Pulvitec"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem ou peso?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1kg"),
                    option("5kg"),
                    option("20kg"),
                    option("20kg saco"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade ajuda na cotação?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 unidade"),
                    option("5 unidades"),
                    option("10 unidades"),
                    option("1 saco"),
                    option("5 sacos"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "weight_volume", "quantity"],
        "required": ["variant"],
        "suggested_aliases": ["vedante", "adesivo", "cimento cola"],
    },
    "argamassa": {
        "keywords": [
            "argamassa",
            "argamassa ac1",
            "argamassa ac2",
            "argamassa ac3",
            "argamassa interna",
            "argamassa externa",
            "argamassa porcelanato",
            "argamassa piso sobre piso",
            "argamassa colante",
        ],
        "display_name": "argamassa",
        "question_label": "argamassa",
        "fields": {
            "variant": {
                "question": "Qual tipo de argamassa?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("AC1"),
                    option("AC2"),
                    option("AC3"),
                    option("Interna"),
                    option("Externa"),
                    option("Porcelanato"),
                    option("Piso sobre piso"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Quartzolit"),
                    option("Votomassa"),
                    option("Fortcola"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual peso do saco?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("20kg"),
                    option("15kg"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade ajuda na cotação?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 saco"),
                    option("5 sacos"),
                    option("10 sacos"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "weight_volume", "quantity"],
        "required": ["variant"],
        "suggested_aliases": [
            "cimento cola",
            "cola de azulejo",
            "argamassa industrializada",
        ],
    },
    "rejunte": {
        "keywords": [
            "rejunte",
            "rejunte acrilico",
            "rejunte acrílico",
            "rejunte epoxi",
            "rejunte epóxi",
            "rejunte flexivel",
            "rejunte flexível",
        ],
        "display_name": "rejunte",
        "question_label": "rejunte",
        "fields": {
            "variant": {
                "question": "Qual tipo de rejunte?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Cimentício"),
                    option("Acrílico"),
                    option("Epóxi"),
                    option("Flexível"),
                    option("Qualquer"),
                ],
            },
            "color_finish": {
                "question": "Qual cor?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Branco"),
                    option("Cinza"),
                    option("Bege"),
                    option("Preto"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1kg"),
                    option("5kg"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "color_finish", "weight_volume"],
        "required": ["variant"],
        "suggested_aliases": ["rejuntamento", "betume de pastilhas"],
    },
    "vedante": {
        "keywords": [
            "vedante",
            "veda rosca",
            "fita veda rosca",
            "veda calha",
            "selante",
            "selante PU",
            "selante pu",
        ],
        "display_name": "vedante",
        "question_label": "vedante",
        "fields": {
            "variant": {
                "question": "Qual tipo de vedante?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Veda rosca"),
                    option("Veda calha"),
                    option("Selante PU"),
                    option("Selante acrílico"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Vedacit"),
                    option("Quartzolit"),
                    option("Sika"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("50m"),
                    option("280g"),
                    option("300ml"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "weight_volume"],
        "required": ["variant"],
        "suggested_aliases": ["fita teflon", "veda-rosca", "fita veda-rosca"],
    },
    "silicone": {
        "keywords": [
            "silicone",
            "silicone acético",
            "silicone acetico",
            "silicone neutro",
            "silicone transparente",
            "silicone branco",
        ],
        "display_name": "silicone",
        "question_label": "silicone",
        "fields": {
            "variant": {
                "question": "Qual tipo de silicone?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Acético"),
                    option("Neutro"),
                    option("Uso geral"),
                    option("Qualquer"),
                ],
            },
            "color_finish": {
                "question": "Qual cor?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Transparente"),
                    option("Branco"),
                    option("Preto"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("50g"),
                    option("280g"),
                    option("300ml"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "color_finish", "weight_volume"],
        "required": ["variant"],
        "suggested_aliases": ["selante de silicone", "cola de silicone"],
    },
    "disjuntor": {
        "keywords": [
            "disjuntor",
            "disjuntor unipolar",
            "disjuntor bipolar",
            "disjuntor tripolar",
            "breaker",
        ],
        "display_name": "disjuntor",
        "question_label": "disjuntor",
        "fields": {
            "variant": {
                "question": "Qual tipo de disjuntor?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Unipolar"),
                    option("Bipolar"),
                    option("Tripolar"),
                    option("Qualquer"),
                ],
            },
            "size_dimension": {
                "question": "Qual amperagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("10A"),
                    option("16A"),
                    option("20A"),
                    option("25A"),
                    option("32A"),
                    option("40A"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Steck"),
                    option("Tramontina"),
                    option("Schneider"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "size_dimension", "brand"],
        "required": ["variant"],
        "suggested_aliases": [
            "disjuntor DR",
            "disjuntor DIN",
            "interruptor automático",
        ],
    },
    "massa": {
        "keywords": [
            "massa",
            "massa corrida",
            "massa acrilica",
            "massa acrílica",
            "massa para parede",
            "massa niveladora",
        ],
        "display_name": "massa",
        "question_label": "massa",
        "fields": {
            "variant": {
                "question": "Qual tipo de massa?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Massa corrida"),
                    option("Massa acrílica"),
                    option("Massa niveladora"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Suvinil"),
                    option("Coral"),
                    option("Sherwin-Williams"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1,5kg"),
                    option("5kg"),
                    option("25kg"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "weight_volume"],
        "required": ["variant"],
        "suggested_aliases": ["massa corrida PVA", "massa acrílica", "massa de parede"],
    },
    "cimento": {
        "keywords": ["cimento", "cp2", "cp3", "cp4", "cpii", "cpiii", "cpiv"],
        "display_name": "cimento",
        "question_label": "cimento",
        "fields": {
            "brand": {
                "question": "Qual marca do cimento?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Votorantim"),
                    option("Itambé"),
                    option("Holcim"),
                    option("Ciplan"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual peso do saco?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("50kg"),
                    option("25kg"),
                    option("Qualquer"),
                ],
            },
            "variant": {
                "question": "Você quer algum tipo específico?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("CP II"),
                    option("CP III"),
                    option("CP IV"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade ajuda na cotação?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 saco"),
                    option("5 sacos"),
                    option("10 sacos"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["brand", "variant", "weight_volume", "quantity"],
        "required": ["brand", "variant"],
        "suggested_aliases": ["cimento portland", "CP2", "CP3"],
    },
    "tinta": {
        "keywords": [
            "tinta",
            "tinta latex",
            "tinta látex",
            "tinta acrilica",
            "tinta acrílica",
            "tinta esmalte",
            "verniz",
            "selador",
            "massa corrida",
        ],
        "display_name": "tinta",
        "question_label": "tinta",
        "fields": {
            "brand": {
                "question": "Qual marca da tinta?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Suvinil"),
                    option("Coral"),
                    option("Sherwin-Williams"),
                    option("Renner"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual volume?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("18L"),
                    option("3,6L"),
                    option("900ml"),
                    option("Qualquer"),
                ],
            },
            "color_finish": {
                "question": "Qual cor ou acabamento?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Branco fosco"),
                    option("Branco acetinado"),
                    option("Cinza fosco"),
                    option("Preto fosco"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade ajuda na cotação?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 lata"),
                    option("2 latas"),
                    option("5 latas"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["brand", "color_finish", "weight_volume", "quantity"],
        "required": ["brand", "color_finish"],
        "suggested_aliases": ["tinta latex", "tinta acrílica", "esmalte", "tinta PVA"],
    },
    "areia": {
        "keywords": [
            "areia",
            "areia lavada",
            "areia fina",
            "areia media",
            "areia média",
            "areia grossa",
        ],
        "display_name": "areia",
        "question_label": "areia",
        "fields": {
            "variant": {
                "question": "Qual tipo de areia?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Lavada"),
                    option("Fina"),
                    option("Média"),
                    option("Grossa"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual unidade para cotar?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Saco 20kg"),
                    option("Saco 25kg"),
                    option("m³"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade ajuda na cotação?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 saco"),
                    option("10 sacos"),
                    option("1 m³"),
                    option("2 m³"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "weight_volume", "quantity"],
        "required": ["variant"],
        "suggested_aliases": ["areia de construção", "areia de rio"],
    },
    "tijolo": {
        "keywords": [
            "tijolo",
            "bloco",
            "bloco ceramico",
            "bloco cerâmico",
            "tijolo macico",
            "tijolo maciço",
            "tijolo furado",
        ],
        "display_name": "tijolo",
        "question_label": "tijolo",
        "fields": {
            "size_dimension": {
                "question": "Qual dimensão ou tipo?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("9x19x19"),
                    option("14x19x29"),
                    option("Maciço"),
                    option("Furado"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("100 unidades"),
                    option("500 unidades"),
                    option("1000 unidades"),
                    option("1 pallet"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["size_dimension", "quantity"],
        "required": ["size_dimension"],
        "suggested_aliases": ["bloco cerâmico", "tijolo baiano"],
    },
    "ferro": {
        "keywords": [
            "ferro",
            "vergalhao",
            "vergalhão",
            "barra de ferro",
            "aco",
            "aço",
            "ca50",
            "ca60",
        ],
        "display_name": "ferro",
        "question_label": "ferro",
        "fields": {
            "size_dimension": {
                "question": "Qual bitola?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("4,2mm"),
                    option("5mm"),
                    option("6,3mm"),
                    option("8mm"),
                    option("10mm"),
                    option("12,5mm"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual comprimento?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("6m"),
                    option("12m"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 barra"),
                    option("5 barras"),
                    option("10 barras"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["size_dimension", "weight_volume", "quantity"],
        "required": ["size_dimension"],
        "suggested_aliases": ["vergalhão", "aço CA50", "aço CA60", "barra de aço"],
    },
    "tubo": {
        "keywords": [
            "tubo",
            "cano",
            "tubo pvc",
            "cano pvc",
            "conexao",
            "conexão",
            "joelho",
            "luva",
            "te",
        ],
        "display_name": "tubo",
        "question_label": "tubo",
        "fields": {
            "variant": {
                "question": "É tubo ou conexão?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Tubo PVC"),
                    option("Joelho"),
                    option("Luva"),
                    option("Tê"),
                    option("Qualquer"),
                ],
            },
            "size_dimension": {
                "question": "Qual diâmetro?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("25mm"),
                    option("32mm"),
                    option("50mm"),
                    option("75mm"),
                    option("100mm"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual comprimento?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("3m"),
                    option("6m"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "size_dimension", "weight_volume"],
        "required": ["variant", "size_dimension"],
        "suggested_aliases": ["cano PVC", "tubo de esgoto", "cano de água fria"],

    },
    "fio": {
        "keywords": [
            "fio",
            "cabo",
            "fio eletrico",
            "fio elétrico",
            "cabo eletrico",
            "cabo elétrico",
            "fio flexivel",
            "fio flexível",
            "cabo pp",
        ],
        "display_name": "fio",
        "question_label": "fio",
        "fields": {
            "size_dimension": {
                "question": "Qual bitola?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1,5mm²"),
                    option("2,5mm²"),
                    option("4mm²"),
                    option("6mm²"),
                    option("10mm²"),
                    option("Qualquer"),
                ],
            },
            "color_finish": {
                "question": "Qual cor?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Preto"),
                    option("Vermelho"),
                    option("Azul"),
                    option("Verde"),
                    option("Branco"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Rolo de quantos metros?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("50m"),
                    option("100m"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["size_dimension", "color_finish", "weight_volume"],
        "required": ["size_dimension"],
        "suggested_aliases": ["cabo elétrico", "fio flexível", "fio rígido"],
    },
    "telha": {
        "keywords": [
            "telha",
            "telha ceramica",
            "telha cerâmica",
            "fibrocimento",
            "telha metalica",
            "telha metálica",
        ],
        "display_name": "telha",
        "question_label": "telha",
        "fields": {
            "variant": {
                "question": "Qual tipo de telha?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Cerâmica"),
                    option("Fibrocimento"),
                    option("Metálica"),
                    option("Concreto"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Eternit"),
                    option("Brasilit"),
                    option("Qualquer"),
                ],
            },
            "size_dimension": {
                "question": "Qual dimensão ou espessura?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("6mm"),
                    option("8mm"),
                    option("1,83x0,50m"),
                    option("2,44x1,10m"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "size_dimension"],
        "required": ["variant"],
        "suggested_aliases": ["telha de barro", "telha francesa", "capa e canal"],
    },
    "ceramica": {
        "keywords": [
            "ceramica",
            "cerâmica",
            "porcelanato",
            "revestimento",
            "piso",
            "azulejo",
        ],
        "display_name": "cerâmica",
        "question_label": "cerâmica",
        "fields": {
            "size_dimension": {
                "question": "Qual formato?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("60x60"),
                    option("80x80"),
                    option("30x60"),
                    option("120x120"),
                    option("Qualquer"),
                ],
            },
            "color_finish": {
                "question": "Qual cor ou acabamento?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Branco brilhante"),
                    option("Cinza fosco"),
                    option("Madeira natural"),
                    option("Bege acetinado"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Portobello"),
                    option("Eliane"),
                    option("Ceusa"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade ajuda na cotação?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("5m²"),
                    option("10m²"),
                    option("20m²"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["size_dimension", "color_finish", "brand", "quantity"],
        "required": ["size_dimension"],
        "suggested_aliases": ["porcelanato", "azulejo", "revestimento cerâmico"],
    },
    "gesso": {
        "keywords": ["gesso", "drywall", "placa de gesso", "forro de gesso"],
        "display_name": "gesso",
        "question_label": "gesso",
        "fields": {
            "variant": {
                "question": "É saco ou placa?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Saco"),
                    option("Placa"),
                    option("Drywall"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual peso ou tamanho?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("20kg"),
                    option("40kg"),
                    option("1,20x1,80"),
                    option("1,20x2,40"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Placo"),
                    option("Knauf"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "weight_volume", "brand"],
        "required": ["variant"],
        "suggested_aliases": ["gesso em pó", "gesso acartonado", "drywall"],
    },
    "brita": {
        "keywords": [
            "brita",
            "pedra britada",
            "pedrisco",
            "agregado graudo",
            "agregado graúdo",
            "brita 0",
            "brita 1",
            "brita 2",
        ],
        "display_name": "brita",
        "question_label": "brita",
        "fields": {
            "variant": {
                "question": "Qual tipo de brita?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Brita 0"),
                    option("Brita 1"),
                    option("Brita 2"),
                    option("Pedrisco"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual unidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("m³"),
                    option("Saco 20kg"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 m³"),
                    option("2 m³"),
                    option("5 m³"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "weight_volume", "quantity"],
        "required": ["variant"],
        "suggested_aliases": ["pedra britada", "agregado graúdo", "pedra 1"],
    },
    "cal": {
        "keywords": [
            "cal",
            "cal hidratada",
            "cal virgem",
            "ch1",
            "ch3",
            "calcario",
            "calcário",
        ],
        "display_name": "cal",
        "question_label": "cal",
        "fields": {
            "variant": {
                "question": "Qual tipo de cal?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Cal hidratada CH I"),
                    option("Cal hidratada CH III"),
                    option("Cal virgem"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("20kg"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 saco"),
                    option("5 sacos"),
                    option("10 sacos"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "weight_volume", "quantity"],
        "required": ["variant"],
        "suggested_aliases": ["cal em pó", "hidratada"],
    },
    "impermeabilizante": {
        "keywords": [
            "impermeabilizante",
            "manta",
            "manta asfaltica",
            "manta asfáltica",
            "manta impermeavel",
            "manta impermeável",
            "hidrostatico",
            "hidrostático",
            "impermeavel",
            "impermeável",
        ],
        "display_name": "impermeabilizante",
        "question_label": "impermeabilizante",
        "fields": {
            "variant": {
                "question": "Qual tipo de impermeabilizante?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Manta asfáltica"),
                    option("Líquido"),
                    option("Cimentício"),
                    option("Membrana"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Vedacit"),
                    option("Sika"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("3,6L"),
                    option("18L"),
                    option("1m²"),
                    option("10m²"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "weight_volume"],
        "required": ["variant"],
        "suggested_aliases": ["manta de impermeabilização", "vedacit", "impermeável líquido"],
    },
    "reboco": {
        "keywords": [
            "reboco",
            "rebôco",
            "chapisco",
            "regularizadora",
            "contrapiso",
            "contra piso",
            "argamassa de regularizacao",
            "argamassa de regularização",
        ],
        "display_name": "reboco",
        "question_label": "reboco",
        "fields": {
            "variant": {
                "question": "Qual tipo?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Reboco"),
                    option("Chapisco"),
                    option("Regularizadora"),
                    option("Contrapiso"),
                    option("Qualquer"),
                ],
            },
            "brand": {
                "question": "Qual marca?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Quartzolit"),
                    option("Votomassa"),
                    option("Qualquer"),
                ],
            },
            "weight_volume": {
                "question": "Qual embalagem?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("20kg"),
                    option("25kg"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("1 saco"),
                    option("5 sacos"),
                    option("10 sacos"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["variant", "brand", "weight_volume", "quantity"],
        "required": ["variant"],
        "suggested_aliases": ["reboco industrializado", "chapisco"],
    },
    "parafuso": {
        "keywords": [
            "parafuso",
            "prego",
            "bucha",
            "chumbador",
            "grampo",
            "porca",
            "arruela",
        ],
        "display_name": "parafuso",
        "question_label": "parafuso",
        "fields": {
            "size_dimension": {
                "question": "Qual medida ou bitola?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("M6x50"),
                    option("M8x50"),
                    option("3/8x2½"),
                    option("4,2x25"),
                    option("Qualquer"),
                ],
            },
            "variant": {
                "question": "Qual tipo?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("Rosca soberba"),
                    option("Autoatarraxante"),
                    option("Sextavado"),
                    option("Com bucha"),
                    option("Qualquer"),
                ],
            },
            "quantity": {
                "question": "Qual quantidade?",
                "input_type": "chips",
                "allow_free_text": True,
                "options": [
                    option("100 unidades"),
                    option("500 unidades"),
                    option("1 caixa"),
                    option("Qualquer"),
                ],
            },
        },
        "priority": ["size_dimension", "variant", "quantity"],
        "required": ["size_dimension"],
        "suggested_aliases": [
            "parafuso auto-atarraxante",
            "prego",
            "bucha com parafuso",
        ],
    },
}

ATTRIBUTE_PRIORITY = [
    "supplier_scope",
    "variant",
    "brand",
    "weight_volume",
    "size_dimension",
    "color_finish",
    "model",
    "quantity",
]

# ─── Generic (unknown) product flow ──────────────────────────────────────────
# When the user types a product not in PRODUCT_KB, we run a 2-step refinement
# to build a precise scraper query:  "{product} {brand/model} {spec/size}"

_GENERIC_SPEC_Q = "Qual marca, modelo ou especificação?"


def _first_message_already_specific(message: str) -> bool:
    """True if the first query already carries enough specificity to skip refinement."""
    words = message.strip().split()
    if len(words) >= 3:
        return True
    if extract_brand(message) is not None:
        return True
    if extract_first_match(message, DIMENSION_PATTERNS) is not None:
        return True
    if extract_first_match(message, WEIGHT_PATTERNS) is not None:
        return True
    return False


def _build_generic_product(message: str, history: list[dict]) -> dict:
    """
    Rebuilds generic-flow state from conversation history.
    Returns {"product_label": str, "spec": str|None, "spec_asked": bool}
    """
    user_msgs = [e["content"].strip() for e in history if e["role"] == "user"]
    user_msgs.append(message.strip())

    product_label = compact_spaces(user_msgs[0]) if user_msgs else message.strip()

    asst_msgs = [e for e in history if e["role"] == "assistant"]
    spec_asked = False
    spec: Optional[str] = None

    for i, asst in enumerate(asst_msgs):
        if _GENERIC_SPEC_Q in asst.get("content", ""):
            spec_asked = True
            if i + 1 < len(user_msgs):
                ans = user_msgs[i + 1].strip()
                if not (is_broad_answer(ans) or normalize(ans) == "qualquer"):
                    spec = ans
            break

    return {"product_label": product_label, "spec": spec, "spec_asked": spec_asked}

GENERIC_WELCOME = (
    "Olá! Sou seu assistente de cotação.\n\n"
    "Me diga o material que você precisa buscar. Ex: cimento, cola, tinta branca, tubo PVC."
)

PRODUCT_NOT_FOUND_TEMPLATE = (
    "Não reconheci \"{query}\" no meu catálogo. 🤔\n\n"
    "Consigo cotar: cimento, areia, brita, tinta, tijolo, ferro/vergalhão, tubo/cano, "
    "fio elétrico, telha, cerâmica/porcelanato, argamassa, rejunte, cola, gesso, "
    "parafuso, cal, impermeabilizante, massa corrida e outros.\n\n"
    "Tente digitar apenas o nome do material."
)


# -----------------------------------------------------------------------------
# Extraction
# -----------------------------------------------------------------------------

WEIGHT_PATTERNS = [
    r"\d+[,.]?\d*\s*(?:kg|kgs?|g)\b",
    r"\d+[,.]?\d*\s*(?:l|lt|litro|litros|ml)\b",
    r"\d+[,.]?\d*\s*(?:m³|m3)\b",
    r"\d+[,.]?\d*\s*m\b",
]

DIMENSION_PATTERNS = [
    r"\d+(?:[,.]?\d+)?\s*[xX]\s*\d+(?:[,.]?\d+)?(?:\s*[xX]\s*\d+(?:[,.]?\d+)?)?(?:\s*(?:cm|mm|m))?",
    r"\d+[,.]?\d*\s*mm(?:²|2)?\b",
    r"\d+[,.]?\d*\s*cm\b",
    r"\d+[,.]?\d*\s*m\b",
    r"\bM\d+(?:[xX]\d+)?\b",
    r"\d+/\d+",
]

QUANTITY_PATTERNS = [
    r"\d+\s*(?:un|unidade|unidades|pcs|pecas|peças)\b",
    r"\d+\s*(?:saco|sacos)\b",
    r"\d+\s*(?:caixa|caixas|cx)\b",
    r"\d+\s*(?:barra|barras)\b",
    r"\d+\s*(?:lata|latas)\b",
    r"\d+\s*(?:m²|m2)\b",
    r"\d+\s*(?:pallet|pallets)\b",
]

KNOWN_COLORS_FINISHES = [
    "branco",
    "preto",
    "cinza",
    "azul",
    "vermelho",
    "verde",
    "amarelo",
    "bege",
    "marrom",
    "natural",
    "madeira",
    "fosco",
    "acetinado",
    "brilhante",
    "semi-brilho",
]


def extract_first_match(text: str, patterns: list[str]) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return compact_spaces(match.group(0))
    return None


def extract_brand(text: str) -> Optional[str]:
    norm = normalize(text)
    for brand in KNOWN_BRANDS:
        if re.search(r"\b" + re.escape(normalize(brand)) + r"\b", norm):
            return brand
    match = re.search(
        r"\b(?:marca|prefiro|preferencia|preferência)\s+([A-Za-zÀ-ÿ0-9\-]+)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return title_case(match.group(1))
    return None


def extract_color_finish(text: str) -> Optional[str]:
    norm = normalize(text)
    found: list[str] = []
    for item in KNOWN_COLORS_FINISHES:
        if re.search(r"\b" + re.escape(normalize(item)) + r"\b", norm):
            found.append(item)
    found = unique_keep_order(found)
    if not found:
        return None
    return " ".join(found)


def detect_products(text: str) -> list[str]:
    norm = normalize(text)
    found: list[str] = []
    for product_key, config in PRODUCT_KB.items():
        for keyword in config["keywords"]:
            pattern = r"\b" + re.escape(normalize(keyword)) + r"\b"
            if re.search(pattern, norm):
                found.append(product_key)
                break
    return unique_keep_order(found)


def detect_field_from_assistant_message(
    message: str,
) -> tuple[Optional[str], Optional[str]]:
    norm = normalize(message)
    for product_key, product_cfg in PRODUCT_KB.items():
        label = normalize(product_cfg.get("question_label", product_key))
        if label in norm:
            for field_key, field_cfg in product_cfg["fields"].items():
                question = normalize(field_cfg["question"])
                if question in norm or any(
                    normalize(opt["label"]) in norm
                    for opt in field_cfg.get("options", [])
                ):
                    return product_key, field_key
    if "fornecedor" in norm:
        return None, "supplier_scope"

    # Aliases step detection
    if (
        "outros nomes" in norm
        or "quer buscar com" in norm
        or "buscar com outros" in norm
    ):
        for product_key, product_cfg in PRODUCT_KB.items():
            label = normalize(product_cfg.get("question_label", product_key))
            if label in norm:
                return product_key, "aliases"
        return None, "aliases"

    return None, None


def normalize_free_value(field: str, value: str) -> str:
    value = compact_spaces(value)

    if is_broad_answer(value):
        return "qualquer"

    if field == "brand":
        detected = extract_brand(value)
        return detected or title_case(value)

    if field == "weight_volume":
        detected = extract_first_match(value, WEIGHT_PATTERNS)
        return detected or value

    if field == "size_dimension":
        detected = extract_first_match(value, DIMENSION_PATTERNS)
        return detected or value

    if field == "quantity":
        detected = extract_first_match(value, QUANTITY_PATTERNS)
        return detected or value

    if field == "color_finish":
        detected = extract_color_finish(value)
        return detected or value

    if field == "aliases":
        skip_words = {"nao", "não", "pular", "ok", "qualquer"}
        norm_v = normalize(value)
        if any(w in norm_v for w in skip_words) and len(value.strip()) < 25:
            return ""
        parts = [p.strip() for p in re.split(r"[,|;]", value) if p.strip()]
        filtered = [p for p in parts if normalize(p) not in skip_words and len(p) > 1]
        return "|".join(filtered) if filtered else ""

    return value


def extract_field_value_from_text(
    field: str, text: str, field_cfg: dict[str, Any]
) -> Optional[str]:
    if is_broad_answer(text):
        return "qualquer"

    norm = normalize(text)

    for opt in field_cfg.get("options", []):
        if normalize(opt["label"]) in norm:
            label = opt["label"]
            return "qualquer" if normalize(label) == "qualquer" else label

    if field == "brand":
        return extract_brand(text)

    if field == "weight_volume":
        return extract_first_match(text, WEIGHT_PATTERNS)

    if field == "size_dimension":
        return extract_first_match(text, DIMENSION_PATTERNS)

    if field == "quantity":
        return extract_first_match(text, QUANTITY_PATTERNS)

    if field == "color_finish":
        return extract_color_finish(text)

    if field == "aliases":
        skip_words = {
            "nao",
            "não",
            "pular",
            "ok",
            "sim",
            "pode seguir",
            "pode continuar",
            "sem variante",
            "sem variantes",
            "qualquer",
            "nao precisa",
            "não precisa",
        }
        norm_t = normalize(text)
        if any(w in norm_t for w in skip_words) and len(text.strip()) < 30:
            return ""  # explicitly skipped
        parts = [p.strip() for p in re.split(r"[,|;]", text) if p.strip()]
        filtered = [p for p in parts if normalize(p) not in skip_words and len(p) > 1]
        if not filtered:
            return ""
        return "|".join(filtered)

    return None


# -----------------------------------------------------------------------------
# Conversation reconstruction
# -----------------------------------------------------------------------------


def initial_product_state(product_key: str) -> dict[str, Any]:
    return {
        "product_key": product_key,
        "display_name": PRODUCT_KB[product_key]["display_name"],
        "attrs": {
            "variant": None,
            "brand": None,
            "weight_volume": None,
            "size_dimension": None,
            "color_finish": None,
            "model": None,
            "quantity": None,
            "aliases": None,
        },
    }


def resolve_supplier_scope(
    user_text: str, supplier_names: list[str]
) -> tuple[Optional[str], list[str]]:
    norm = normalize(user_text)

    if (
        "todos os fornecedores" in norm
        or "todo fornecedor" in norm
        or "qualquer fornecedor" in norm
    ):
        return "all", []

    for name in supplier_names:
        if normalize(name) in norm:
            return "single", [name]

    return None, []


def build_conversation_state(
    message: str,
    history: list[dict[str, Any]],
    supplier_names: Optional[list[str]] = None,
) -> dict[str, Any]:
    supplier_names = supplier_names or []

    user_texts = [
        entry.get("content", "") for entry in history if entry.get("role") == "user"
    ]
    user_texts.append(message)
    full_user_text = " ".join(user_texts)

    detected_products = detect_products(full_user_text)

    products_state: dict[str, dict[str, Any]] = {
        product_key: initial_product_state(product_key)
        for product_key in detected_products
    }

    supplier_scope: Optional[str] = None
    selected_suppliers: list[str] = []

    pending_product: Optional[str] = None
    pending_field: Optional[str] = None

    timeline = history + [{"role": "user", "content": message}]

    for entry in timeline:
        role = entry.get("role")
        content = entry.get("content", "")

        if role == "assistant":
            pending_product, pending_field = detect_field_from_assistant_message(
                content
            )
            continue

        if role != "user":
            continue

        inferred_scope, inferred_suppliers = resolve_supplier_scope(
            content, supplier_names
        )
        if inferred_scope:
            supplier_scope = inferred_scope
            selected_suppliers = inferred_suppliers

        # Only detect new products when user is sending a free-text message,
        # not when answering a specific field question (prevents alias text
        # like "cimento cola" from adding "cimento" as a new product).
        if not pending_field:
            newly_detected = detect_products(content)
            for product_key in newly_detected:
                if product_key not in products_state:
                    products_state[product_key] = initial_product_state(product_key)
                    detected_products.append(product_key)

        if pending_field == "supplier_scope":
            inferred_scope, inferred_suppliers = resolve_supplier_scope(
                content, supplier_names
            )
            if inferred_scope:
                supplier_scope = inferred_scope
                selected_suppliers = inferred_suppliers
            elif is_broad_answer(content):
                supplier_scope = "all"
                selected_suppliers = []
            pending_field = None
            pending_product = None
            continue

        if pending_product and pending_field and pending_product in products_state:
            # "aliases" is not in the fields dict — handle it specially so that
            # "Pular" (skip) is recorded as "" and the step is not repeated.
            if pending_field == "aliases":
                raw = extract_field_value_from_text("aliases", content, {})
                # raw is "" for skip words, "|"-joined string for real aliases
                products_state[pending_product]["attrs"]["aliases"] = raw if raw is not None else ""
                pending_field = None
                pending_product = None
                continue

            field_cfg = PRODUCT_KB[pending_product]["fields"].get(pending_field, {})
            value = extract_field_value_from_text(pending_field, content, field_cfg)
            if value:
                products_state[pending_product]["attrs"][pending_field] = value
            elif field_cfg.get("allow_free_text"):
                products_state[pending_product]["attrs"][pending_field] = (
                    normalize_free_value(
                        pending_field,
                        content,
                    )
                )
            pending_field = None
            pending_product = None
            continue

        # opportunistic extraction from free text
        for product_key in list(products_state.keys()):
            product_cfg = PRODUCT_KB[product_key]
            attrs = products_state[product_key]["attrs"]

            for field_key, field_cfg in product_cfg["fields"].items():
                if attrs.get(field_key) is not None:
                    continue
                value = extract_field_value_from_text(field_key, content, field_cfg)
                if value:
                    attrs[field_key] = value

    return {
        "detected_products": unique_keep_order(detected_products),
        "supplier_scope": supplier_scope,
        "selected_suppliers": selected_suppliers,
        "products": products_state,
    }


# -----------------------------------------------------------------------------
# Decision logic
# -----------------------------------------------------------------------------


def is_product_ready(product_key: str, attrs: dict[str, Any]) -> bool:
    required = PRODUCT_KB[product_key].get("required", [])
    if not required:
        return True
    return all(attrs.get(field) is not None for field in required)


def next_missing_field(product_key: str, attrs: dict[str, Any]) -> Optional[str]:
    product_cfg = PRODUCT_KB[product_key]
    required_fields = product_cfg.get("required", [])

    for field in required_fields:
        if attrs.get(field) is None:
            return field

    # Aliases: optional, asked after all required fields are done
    has_aliases = PRODUCT_KB[product_key].get("suggested_aliases")
    if has_aliases and attrs.get("aliases") is None:
        return "aliases"

    return None


def build_supplier_step(supplier_names: list[str]) -> dict[str, Any]:
    return {
        "step": "supplier_scope",
        "input_type": "select",
        "allow_free_text": False,
        "message": "Qual fornecedor você quer consultar primeiro?",
        "options": [option("Todos os fornecedores")]
        + [option(name) for name in supplier_names],
    }


def build_product_step(
    product_key: str,
    field_key: str,
    current_index: int,
    total_products: int,
) -> dict[str, Any]:
    product_cfg = PRODUCT_KB[product_key]

    # ── Aliases step is special ────────────────────────────────────────────
    if field_key == "aliases":
        suggested = product_cfg.get("suggested_aliases", [])
        base_msg = (
            f"Quer buscar {product_cfg['question_label']} com outros nomes também? "
            f"Por ex: {', '.join(suggested[:3])}. "
            "Selecione um ou mais, ou clique em Pular."
        )
        if total_products > 1:
            msg = f"Item {current_index}/{total_products} · {base_msg}"
        else:
            msg = base_msg
        return {
            "step": "aliases",
            "product": product_key,
            "active_product": product_key,
            "progress_current": current_index,
            "progress_total": total_products,
            "input_type": "multi_chips",
            "allow_free_text": True,
            "message": msg,
            "options": [option(name) for name in suggested] + [option("Pular")],
            "suggested_aliases": suggested,
        }

    # ── Regular field step ────────────────────────────────────────────────
    field_cfg = product_cfg["fields"][field_key]

    if total_products > 1:
        message = (
            f"Item {current_index}/{total_products} · "
            f"Sobre {product_cfg['question_label']}: {field_cfg['question']}"
        )
    else:
        message = f"Sobre {product_cfg['question_label']}: {field_cfg['question']}"

    return {
        "step": field_key,
        "product": product_key,
        "active_product": product_key,
        "progress_current": current_index,
        "progress_total": total_products,
        "input_type": field_cfg["input_type"],
        "allow_free_text": field_cfg.get("allow_free_text", False),
        "message": message,
        "options": field_cfg.get("options", []),
        "suggested_aliases": [],
    }


# -----------------------------------------------------------------------------
# Output builders
# -----------------------------------------------------------------------------


def build_search_item(product_key: str, product_state: dict[str, Any]) -> str:
    attrs = product_state["attrs"]
    parts = [PRODUCT_KB[product_key]["display_name"]]

    for field in [
        "variant",
        "brand",
        "weight_volume",
        "size_dimension",
        "color_finish",
        "model",
    ]:
        value = attrs.get(field)
        if value and normalize(value) != "qualquer":
            parts.append(str(value))

    quantity = attrs.get("quantity")
    if quantity and normalize(quantity) != "qualquer":
        parts.append(quantity)

    return compact_spaces(" ".join(parts))


def build_all_search_items_for_product(
    product_key: str, product_state: dict[str, Any]
) -> list[str]:
    """Returns the primary search string plus any user-provided alias names."""
    main = build_search_item(product_key, product_state)
    aliases_str = product_state["attrs"].get("aliases") or ""
    if not aliases_str:
        return [main]
    aliases = [a.strip() for a in aliases_str.split("|") if a.strip()]
    return [main] + aliases


def build_summary_lines(state: dict[str, Any]) -> list[str]:
    lines: list[str] = []

    supplier_scope = state["supplier_scope"]
    selected_suppliers = state["selected_suppliers"]

    if supplier_scope == "single" and selected_suppliers:
        lines.append(f"Fornecedores: {', '.join(selected_suppliers)}")
    else:
        lines.append("Fornecedores: todos")

    for product_key in state["detected_products"]:
        search_item = build_search_item(product_key, state["products"][product_key])
        lines.append(search_item)

    return lines


def build_ready_message(state: dict[str, Any]) -> str:
    summary_lines = build_summary_lines(state)
    product_lines = [f"• {line}" for line in summary_lines[1:]]

    supplier_line = summary_lines[0]

    return (
        "✅ Pronto para buscar!\n\n"
        f"📦 {supplier_line}\n\n"
        "📋 Resumo da busca:\n"
        f"{chr(10).join(product_lines)}\n\n"
        "Posso iniciar a cotação agora."
    )


def build_thinking(state: dict[str, Any]) -> str:
    parts = [
        f"products={state['detected_products']}",
        f"supplier_scope={state['supplier_scope']}",
        f"selected_suppliers={state['selected_suppliers']}",
    ]
    for product_key in state["detected_products"]:
        parts.append(f"{product_key}={state['products'][product_key]['attrs']}")
    return " | ".join(parts)


def build_ui_summary(
    state: dict[str, Any],
    active_product: str | None = None,
) -> dict[str, Any]:
    supplier_scope = state["supplier_scope"]
    selected_suppliers = state["selected_suppliers"]

    supplier_label = "Todos os fornecedores"
    if supplier_scope == "single" and selected_suppliers:
        supplier_label = ", ".join(selected_suppliers)

    products_summary: list[dict[str, Any]] = []
    for index, product_key in enumerate(state["detected_products"], start=1):
        product_state = state["products"][product_key]
        attrs = product_state["attrs"]
        selected_fields = []

        for field in [
            "variant",
            "brand",
            "weight_volume",
            "size_dimension",
            "color_finish",
            "model",
            "quantity",
        ]:
            value = attrs.get(field)
            if value is not None:
                selected_fields.append({"field": field, "value": value})

        # Show aliases if any were set
        aliases_str = attrs.get("aliases") or ""
        if aliases_str:
            aliases_display = ", ".join(
                a.strip() for a in aliases_str.split("|") if a.strip()
            )
            if aliases_display:
                selected_fields.append({"field": "aliases", "value": aliases_display})

        products_summary.append(
            {
                "product_key": product_key,
                "label": product_state["display_name"],
                "ready": is_product_ready(product_key, attrs),
                "active": product_key == active_product,
                "position": index,
                "search_item": build_search_item(product_key, product_state),
                "selected_fields": selected_fields,
            }
        )

    return {
        "supplier_label": supplier_label,
        "products": products_summary,
    }


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------


def process_message(
    message: str,
    history: list[dict[str, Any]],
    supplier_names: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Main stateless processor.

    Returns a dict compatible with a richer API shape, for example:
    {
        "message": "...",
        "ready": False,
        "search_items": None,
        "thinking": "...",
        "step": "brand",
        "input_type": "chips",
        "allow_free_text": True,
        "options": [{"label": "...", "value": "..."}],
        "selected_suppliers": [],
        "summary": {...}
    }
    """
    supplier_names = supplier_names or []
    state = build_conversation_state(
        message=message, history=history, supplier_names=supplier_names
    )

    total_products = len(state["detected_products"])

    if not state["detected_products"]:
        msg_stripped = message.strip()

        # Empty / greeting-only input → show welcome
        if len(msg_stripped) <= 2:
            return {
                "message": GENERIC_WELCOME,
                "ready": False,
                "search_items": None,
                "thinking": build_thinking(state),
                "step": "product",
                "active_product": None,
                "progress_current": 0,
                "progress_total": 0,
                "input_type": "text",
                "allow_free_text": True,
                "options": [],
                "selected_suppliers": [],
                "summary": build_ui_summary(state),
            }

        # ── Generic product flow ──────────────────────────────────────────────
        # Any product not in the KB is handled here.
        # Goal: build a precise scraper query  "{product} {brand/model} {spec}"
        g = _build_generic_product(msg_stripped, history)
        product_label = g["product_label"]

        _base_summary: dict = {
            "supplier_label": "Todos os fornecedores",
            "products": [{
                "product_key": "_generic",
                "label": product_label,
                "ready": False,
                "active": True,
                "position": 1,
                "search_item": product_label,
                "selected_fields": [],
            }],
        }

        # Step 1 — ask for brand/model/spec (skip if query already specific)
        if not g["spec_asked"] and not _first_message_already_specific(product_label):
            return {
                "message": (
                    f"Sobre **{product_label}**: {_GENERIC_SPEC_Q}\n\n"
                    "Informe marca, modelo ou medida para uma busca mais precisa.\n"
                    "Ex: _PADO 20mm_, _Yale 40mm_, _Tramontina residencial_."
                ),
                "ready": False,
                "search_items": None,
                "thinking": f"generic:{product_label}",
                "step": "generic_spec",
                "product": None,
                "active_product": None,
                "progress_current": 0,
                "progress_total": 1,
                "input_type": "text",
                "allow_free_text": True,
                "options": [option("Qualquer")],
                "suggested_aliases": [],
                "selected_suppliers": [],
                "summary": _base_summary,
            }

        # Build interim search item
        parts: list[str] = [product_label]
        if g["spec"] and normalize(g["spec"]) != "qualquer":
            parts.append(g["spec"])
        generic_search_item = compact_spaces(" ".join(parts))

        # Step 2 — ask supplier scope (same as KB flow)
        if state["supplier_scope"] is None:
            supplier_step = build_supplier_step(supplier_names)
            return {
                "message": supplier_step["message"],
                "ready": False,
                "search_items": None,
                "thinking": f"generic:{generic_search_item}",
                "step": supplier_step["step"],
                "product": None,
                "active_product": None,
                "progress_current": 0,
                "progress_total": 1,
                "input_type": supplier_step["input_type"],
                "allow_free_text": supplier_step["allow_free_text"],
                "options": supplier_step["options"],
                "suggested_aliases": [],
                "selected_suppliers": state["selected_suppliers"],
                "summary": {
                    **_base_summary,
                    "products": [{**_base_summary["products"][0], "search_item": generic_search_item}],
                },
            }

        # Step 3 — ready
        supplier_label = "Todos os fornecedores"
        if state["supplier_scope"] == "single" and state["selected_suppliers"]:
            supplier_label = ", ".join(state["selected_suppliers"])

        ready_summary: dict = {
            "supplier_label": supplier_label,
            "products": [{
                "product_key": "_generic",
                "label": generic_search_item,
                "ready": True,
                "active": False,
                "position": 1,
                "search_item": generic_search_item,
                "selected_fields": [{"field": "query", "value": generic_search_item}],
            }],
        }
        return {
            "message": (
                "✅ Pronto para buscar!\n\n"
                f"📦 Fornecedores: {supplier_label}\n\n"
                f"📋 Query de busca: **{generic_search_item}**\n\n"
                "Posso iniciar a cotação agora."
            ),
            "ready": True,
            "search_items": [generic_search_item],
            "thinking": f"generic:{generic_search_item}",
            "step": "done",
            "product": None,
            "active_product": None,
            "progress_current": 1,
            "progress_total": 1,
            "input_type": "none",
            "allow_free_text": True,
            "options": [],
            "suggested_aliases": [],
            "selected_suppliers": state["selected_suppliers"],
            "summary": ready_summary,
        }

    if state["supplier_scope"] is None:
        supplier_step = build_supplier_step(supplier_names)
        return {
            "message": supplier_step["message"],
            "ready": False,
            "search_items": None,
            "thinking": build_thinking(state),
            "step": supplier_step["step"],
            "active_product": None,
            "progress_current": 0,
            "progress_total": total_products,
            "input_type": supplier_step["input_type"],
            "allow_free_text": supplier_step["allow_free_text"],
            "options": supplier_step["options"],
            "selected_suppliers": state["selected_suppliers"],
            "summary": build_ui_summary(state),
        }

    for index, product_key in enumerate(state["detected_products"], start=1):
        attrs = state["products"][product_key]["attrs"]
        next_field = next_missing_field(product_key, attrs)
        if next_field:
            step = build_product_step(product_key, next_field, index, total_products)
            return {
                "message": step["message"],
                "ready": False,
                "search_items": None,
                "thinking": build_thinking(state),
                "step": step["step"],
                "product": step["product"],
                "active_product": step["active_product"],
                "progress_current": step["progress_current"],
                "progress_total": step["progress_total"],
                "input_type": step["input_type"],
                "allow_free_text": step["allow_free_text"],
                "options": step["options"],
                "suggested_aliases": step.get("suggested_aliases", []),
                "selected_suppliers": state["selected_suppliers"],
                "summary": build_ui_summary(state, active_product=product_key),
            }

    ready = all(
        is_product_ready(product_key, state["products"][product_key]["attrs"])
        for product_key in state["detected_products"]
    )

    search_items = []
    for product_key in state["detected_products"]:
        search_items.extend(
            build_all_search_items_for_product(
                product_key, state["products"][product_key]
            )
        )

    return {
        "message": build_ready_message(state),
        "ready": ready,
        "search_items": search_items,
        "thinking": build_thinking(state),
        "step": "done",
        "active_product": None,
        "progress_current": total_products,
        "progress_total": total_products,
        "input_type": "none",
        "allow_free_text": True,
        "options": [],
        "selected_suppliers": state["selected_suppliers"],
        "summary": build_ui_summary(state),
    }
