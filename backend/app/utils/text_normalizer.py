import re
import unicodedata

# Palavras muito comuns na busca — não contam como âncora para expansão de sinônimos
QUERY_STOP_WORDS = frozenset(
    {"de", "da", "do", "das", "dos", "com", "para", "em", "e", "a", "o", "as", "os", "un", "cx", "pct"}
)


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
    """Delega para o motor de relevância unificado (ver ``search_relevance``)."""
    from app.utils.search_relevance import relevance_score

    return relevance_score(query, product_name)


def is_match(query: str, product_name: str, threshold: float = 70.0) -> bool:
    """
    Verifica se o produto corresponde à query com base no threshold
    """
    score = calculate_similarity(query, product_name)
    return score >= threshold


def filter_results_by_query(query: str, offers: list) -> list:
    """
    Ranqueia e filtra ofertas por relevância sem exigir match literal de todos os tokens.
    """
    from app.utils.search_relevance import rank_offers_by_query

    return rank_offers_by_query(query, offers)
