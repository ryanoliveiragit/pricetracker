# 🚀 Setup do Backend - API de Web Scraping

## Pré-requisitos

1. **Python 3.10+** instalado
2. **Google Chrome** instalado (para Selenium)

## 📦 Instalação

### 1. Navegar para pasta backend

```bash
cd backend
```

### 2. Criar ambiente virtual

```bash
python -m venv venv
```

### 3. Ativar ambiente virtual

**Windows:**
```bash
.\venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 4. Instalar dependências

```bash
pip install -r requirements.txt
```

### 5. Configurar variáveis de ambiente

```bash
# Copiar arquivo de exemplo
copy .env.example .env

# Editar .env e adicionar credenciais se necessário
```

## ▶️ Executar Backend

### Opção 1: Script automático (Windows)

```bash
.\start.bat
```

### Opção 2: Comando manual

```bash
python main.py
```

### Opção 3: Com uvicorn

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 🌐 Acessar API

Após iniciar, a API estará disponível em:

- **API Base**: http://localhost:8000
- **Documentação Interativa**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/health

## 🧪 Testar API

### Via Documentação Swagger

1. Acesse http://localhost:8000/docs
2. Clique em `POST /api/search`
3. Clique em "Try it out"
4. Cole o JSON de exemplo:

```json
{
  "items": [
    "Cimento Portland CP-II 50kg",
    "Tijolo Cerâmico 6 Furos"
  ]
}
```

5. Clique em "Execute"

### Via cURL

```bash
curl -X POST "http://localhost:8000/api/search" \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["Cimento Portland", "Tijolo Cerâmico"]
  }'
```

### Via Frontend

O frontend já está configurado para usar a API automaticamente quando ela estiver rodando na porta 8000.

## ⚙️ Configuração de Lojas

### Adicionar Credenciais (Lojas com Login)

Edite o arquivo `.env`:

```env
ESTOQUE_ATACADISTA_USERNAME=seu_usuario
ESTOQUE_ATACADISTA_PASSWORD=sua_senha
```

### Ajustar Seletores CSS

Os scrapers em `app/scrapers/` usam seletores CSS genéricos. Você precisa:

1. Abrir o site da loja no navegador
2. Inspecionar elementos (F12)
3. Identificar seletores corretos para:
   - Campo de busca
   - Nome do produto
   - Preço
   - Link do produto
4. Atualizar os seletores no arquivo do scraper

**Exemplo:**

```python
# Em megaleste_scraper.py
product_elements = self.driver.find_elements(
    By.CSS_SELECTOR, 
    ".product-item"  # ← Ajustar conforme site real
)
```

## 🔧 Adicionar Nova Loja

1. Criar arquivo `app/scrapers/nova_loja_scraper.py`
2. Copiar estrutura de um scraper existente
3. Ajustar `store_name`, `base_url` e seletores
4. Adicionar em `app/api/routes/search.py`:

```python
from app.scrapers.nova_loja_scraper import NovaLojaScraper

scrapers = [
    (MegalesteScraper, None),
    (CofemaScraper, None),
    (NovaLojaScraper, None),  # ← Adicionar aqui
]
```

## 🐛 Troubleshooting

### Erro: ChromeDriver não encontrado

O ChromeDriver será baixado automaticamente na primeira execução. Se der erro:

```bash
pip install --upgrade webdriver-manager
```

### Erro: Timeout ao buscar

Aumente o timeout em `.env`:

```env
SCRAPING_TIMEOUT=20
```

### Erro: CORS

Adicione a origem do frontend em `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Ver logs detalhados

```env
LOG_LEVEL=DEBUG
```

## 📊 Arquitetura

```
Frontend (Next.js) → API Backend (FastAPI) → Scrapers (Selenium)
     ↓                      ↓                        ↓
  localhost:3000      localhost:8000         Sites das lojas
```

## ✅ Checklist de Configuração

- [ ] Python 3.10+ instalado
- [ ] Ambiente virtual criado e ativado
- [ ] Dependências instaladas (`pip install -r requirements.txt`)
- [ ] Arquivo `.env` configurado
- [ ] Backend rodando em http://localhost:8000
- [ ] Documentação acessível em http://localhost:8000/docs
- [ ] Frontend configurado para usar porta 8000
- [ ] Seletores CSS ajustados para sites reais (opcional)

## 🎯 Próximos Passos

1. ✅ Backend API criado
2. ⏳ Ajustar seletores CSS para sites reais
3. ⏳ Adicionar credenciais de lojas que requerem login
4. ⏳ Testar busca com produtos reais
5. ⏳ Adicionar mais lojas ao sistema

---

**Dúvidas?** Consulte `backend/README.md` para mais detalhes técnicos.
