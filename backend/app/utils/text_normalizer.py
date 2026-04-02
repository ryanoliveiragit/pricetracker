import re
import unicodedata
from rapidfuzz import fuzz


def normalize_text(text: str) -> str:
    """
    Normaliza texto removendo acentos, convertendo para lowercase e tratando abreviações
    """
    if not text:
        return ""
    
    # Converter para lowercase
    text = text.lower()
    
    # Remover acentos
    text = unicodedata.normalize('NFKD', text)
    text = ''.join([c for c in text if not unicodedata.combining(c)])
    
    # Tratamento de abreviações comuns
    abbreviations = {
        r'\bpct\b': 'pacote',
        r'\bun\b': 'unidade',
        r'\bcx\b': 'caixa',
        r'\bkg\b': 'quilograma',
        r'\bm\b': 'metro',
        r'\bcm\b': 'centimetro',
        r'\bmm\b': 'milimetro',
        r'\bl\b': 'litro',
        r'\bml\b': 'mililitro',
    }
    
    for abbr, full in abbreviations.items():
        text = re.sub(abbr, full, text)
    
    # Remover espaços extras
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def calculate_similarity(query: str, product_name: str) -> float:
    """
    Calcula score de similaridade entre query e nome do produto
    Usa fuzzy matching com threshold de 70%
    """
    query_normalized = normalize_text(query)
    product_normalized = normalize_text(product_name)
    
    # Usar token_sort_ratio para lidar com ordem diferente de palavras
    score = fuzz.token_sort_ratio(query_normalized, product_normalized)
    
    return score


def is_match(query: str, product_name: str, threshold: float = 70.0) -> bool:
    """
    Verifica se o produto corresponde à query com base no threshold
    """
    score = calculate_similarity(query, product_name)
    return score >= threshold


def filter_results_by_query(query: str, offers: list) -> list:
    """
    Filtra resultados garantindo que o nome do produto contenha TODOS os tokens
    da query original. Isso evita que "cadeado 30" retorne modelos diferentes como
    "cadeado 40" ou "fechadura".
    """
    query_normalized = normalize_text(query)
    tokens = query_normalized.split()

    # Ignorar stop words e tokens muito curtos
    stop_words = {'de', 'da', 'do', 'com', 'para', 'em', 'e', 'a', 'o', 'as', 'os', 'un', 'cx', 'pct'}
    key_tokens = [t for t in tokens if len(t) >= 2 and t not in stop_words]

    if not key_tokens:
        return offers

    filtered = []
    for offer in offers:
        name_normalized = normalize_text(offer.product_name.lstrip("✓ "))
        if all(token in name_normalized for token in key_tokens):
            filtered.append(offer)

    # Se o filtro eliminar tudo (ex: sinônimo sem os tokens), retornar sem filtrar
    return filtered if filtered else offers
