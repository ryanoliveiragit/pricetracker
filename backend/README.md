# ConstruPrice Backend API

API de web scraping para comparação de preços de materiais de construção.

## 🚀 Instalação

### 1. Instalar Python 3.10+

Certifique-se de ter Python 3.10 ou superior instalado.

### 2. Criar ambiente virtual

```bash
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e configure as credenciais:

```bash
copy .env.example .env
```

Edite o arquivo `.env` e adicione as credenciais das lojas que requerem login.

### 5. Instalar ChromeDriver

O Selenium precisa do ChromeDriver. Ele será instalado automaticamente na primeira execução via `webdriver-manager`.

## 🏃 Executar

```bash
# Modo desenvolvimento
python main.py

# Ou com uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

A API estará disponível em:
- **API**: http://localhost:8000
- **Documentação**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/health

## 📡 Endpoints

### POST /api/search

Busca produtos em múltiplas lojas.

**Request:**
```json
{
  "items": [
    "Cimento Portland CP-II 50kg",
    "Tijolo Cerâmico 6 Furos"
  ]
}
```

**Response:**
```json
{
  "items": [
    {
      "raw_query": "Cimento Portland CP-II 50kg",
      "normalized_query": "cimento portland cp-ii 50kg",
      "offers": [
        {
          "store": "Estoque Megaleste",
          "product_name": "Cimento Portland CP-II 50kg Votorantim",
          "price": 32.90,
          "currency": "BRL",
          "product_url": "https://...",
          "add_to_cart_url": "https://...",
          "availability": "em_estoque",
          "score": 95.5,
          "timestamp": "2026-03-16T21:00:00Z"
        }
      ]
    }
  ],
  "total_items": 2,
  "stores": ["Estoque Megaleste", "Cofema Materiais"],
  "generated_at": "2026-03-16T21:00:00Z"
}
```

## 🔧 Estrutura do Projeto

```
backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       └── search.py          # Endpoints de busca
│   ├── scrapers/
│   │   ├── base_scraper.py        # Classe base para scrapers
│   │   ├── megaleste_scraper.py   # Scraper Megaleste
│   │   ├── cofema_scraper.py      # Scraper Cofema
│   │   └── estoque_atacadista_scraper.py  # Scraper Estoque Atacadista
│   ├── models/
│   │   └── product.py             # Modelos Pydantic
│   ├── utils/
│   │   └── text_normalizer.py     # Normalização e fuzzy matching
│   └── config.py                  # Configurações
├── main.py                        # Entrada da aplicação
├── requirements.txt               # Dependências Python
└── .env.example                   # Exemplo de variáveis de ambiente
```

## 🛠️ Adicionar Nova Loja

Para adicionar uma nova loja ao sistema:

1. Crie um novo arquivo em `app/scrapers/` (ex: `nova_loja_scraper.py`)
2. Herde de `BaseScraper` e implemente os métodos `search()` e `login()`
3. Adicione o scraper em `app/api/routes/search.py` na lista de scrapers
4. Ajuste os seletores CSS conforme a estrutura HTML do site

**Exemplo:**

```python
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

class NovaLojaScraper(BaseScraper):
    def __init__(self):
        super().__init__(
            store_name="Nova Loja",
            base_url="https://novaloja.com.br",
            timeout=10
        )
    
    def login(self, username: str, password: str) -> bool:
        # Implementar login se necessário
        return True
    
    def search(self, query: str) -> List[ProductOffer]:
        # Implementar busca
        pass
```

## ⚠️ Notas Importantes

1. **Seletores CSS**: Os seletores CSS nos scrapers são exemplos genéricos. Você precisa inspecionar cada site e ajustar os seletores conforme a estrutura HTML real.

2. **Credenciais**: Para lojas que requerem login (como Estoque Atacadista), configure as credenciais no arquivo `.env`.

3. **Rate Limiting**: Respeite os termos de uso dos sites. Considere adicionar delays entre requisições.

4. **Headless Mode**: Por padrão, o Selenium roda em modo headless (sem interface gráfica). Para debug, altere `headless=False` em `_init_driver()`.

5. **Timeout**: Cada scraper tem timeout de 10 segundos. Se uma loja não responder, ela será pulada sem travar a busca geral.

## 🔍 Debug

Para ver os logs detalhados:

```bash
# Alterar LOG_LEVEL no .env
LOG_LEVEL=DEBUG
```

## 📝 TODO

- [ ] Ajustar seletores CSS para sites reais
- [ ] Implementar cache de resultados (24h)
- [ ] Adicionar tratamento de CAPTCHA
- [ ] Implementar rate limiting
- [ ] Adicionar testes unitários
- [ ] Dockerizar aplicação
