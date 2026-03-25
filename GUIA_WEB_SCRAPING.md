# 🔍 Guia Completo - Web Scraping por Fornecedor

## 📋 Resumo

Sistema de web scraping que busca produtos pelo nome em fornecedores específicos, retornando **TODOS** os resultados encontrados com informações completas.

## ✅ Requisitos Implementados

- ✅ **Modo Headless**: Scraping sem abrir janela/GUI
- ✅ **Login Automático**: Credenciais vindas do CRUD ou variáveis de ambiente (sem hardcode)
- ✅ **Busca Completa**: Retorna todos os produtos compatíveis (não apenas um)
- ✅ **Informações Detalhadas**: Nome, preço, SKU, imagem, disponibilidade, link
- ✅ **JavaScript Dinâmico**: Aguarda carregamento completo da página
- ✅ **Segurança**: Credenciais tratadas com segurança, sem logs em texto plano

---

## 🚀 Instalação

### 1. Instalar Dependências

```bash
cd backend
pip install -r requirements.txt
```

**Nova dependência adicionada:**
- `cryptography>=41.0.0` - Para criptografia de credenciais

### 2. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite `.env` e configure as credenciais dos fornecedores:

```env
# Estoque Megaleste
SUPPLIER_ESTOQUE_MEGALESTE_USERNAME=seu_usuario
SUPPLIER_ESTOQUE_MEGALESTE_PASSWORD=sua_senha

# Cofema Materiais (não requer login)
SUPPLIER_COFEMA_MATERIAIS_USERNAME=
SUPPLIER_COFEMA_MATERIAIS_PASSWORD=

# Estoque Atacadista
SUPPLIER_ESTOQUE_ATACADISTA_USERNAME=seu_usuario
SUPPLIER_ESTOQUE_ATACADISTA_PASSWORD=sua_senha
```

### 3. (Opcional) Gerar Chave de Criptografia

Para criptografar senhas no banco de dados:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Adicione a chave gerada no `.env`:

```env
CREDENTIALS_ENCRYPTION_KEY=sua_chave_gerada_aqui
```

---

## 🔧 Como Usar

### Opção 1: Via API REST

**Endpoint:**
```
POST /api/search-by-supplier
```

**Request:**
```json
{
  "product_name": "Cimento Portland CP-II 50kg",
  "supplier_id": "sup_12345",
  "supplier_name": "Estoque Megaleste"
}
```

**Response:**
```json
{
  "product_name": "Cimento Portland CP-II 50kg",
  "supplier_id": "sup_12345",
  "supplier_name": "Estoque Megaleste",
  "total_results": 15,
  "results": [
    {
      "store": "Estoque Megaleste",
      "product_name": "Cimento Portland CP-II E-32 50kg",
      "price": 32.90,
      "sku": "CIM-CP2-50",
      "image_url": "https://...",
      "product_url": "https://...",
      "availability": "em_estoque",
      "score": 0.95
    }
  ]
}
```

### Opção 2: Via Swagger UI

1. Inicie o servidor: `python main.py`
2. Acesse: http://localhost:8000/docs
3. Encontre `POST /api/search-by-supplier`
4. Clique em "Try it out"
5. Preencha o JSON e clique em "Execute"

### Opção 3: Via Script Python

Execute o exemplo prático:

```bash
python example_search_by_supplier.py
```

---

## 📚 Documentação Completa

### Arquivos de Documentação

1. **[SEARCH_BY_SUPPLIER_API.md](backend/SEARCH_BY_SUPPLIER_API.md)** - Documentação completa da API
2. **[example_search_by_supplier.py](backend/example_search_by_supplier.py)** - Exemplos práticos de uso
3. **[.env.example](backend/.env.example)** - Template de configuração

### Estrutura do Código

```
backend/
├── app/
│   ├── scrapers/
│   │   ├── base_scraper.py              # ✨ Atualizado - suporte a múltiplos resultados
│   │   ├── megaleste_scraper.py         # ✨ Atualizado - extrai SKU, imagem, etc
│   │   ├── cofema_scraper.py            # ✨ Atualizado - retorna todos os resultados
│   │   └── estoque_atacadista_scraper.py # ✨ Atualizado - login + scraping completo
│   ├── services/
│   │   ├── __init__.py                  # 🆕 Novo
│   │   └── credentials_manager.py       # 🆕 Novo - gerenciamento seguro de credenciais
│   ├── models/
│   │   └── product.py                   # ✨ Atualizado - novos campos (SKU, imagem, etc)
│   └── api/
│       └── routes/
│           └── search.py                # ✨ Atualizado - novo endpoint /search-by-supplier
├── requirements.txt                     # ✨ Atualizado - adicionado cryptography
├── .env.example                         # ✨ Atualizado - novas variáveis
├── SEARCH_BY_SUPPLIER_API.md            # 🆕 Novo - documentação da API
└── example_search_by_supplier.py        # 🆕 Novo - exemplos de uso
```

---

## 🎯 Fluxo de Funcionamento

### 1. Recebe Request

```json
{
  "product_name": "Cimento Portland",
  "supplier_id": "sup_001",
  "supplier_name": "Estoque Megaleste"
}
```

### 2. Busca Credenciais

- **Prioridade 1**: Credenciais na request (`username`, `password`)
- **Prioridade 2**: Variáveis de ambiente (`.env`)
- **Prioridade 3**: Banco de dados (futuro)

### 3. Inicia Scraper em Modo Headless

```python
# Chrome em modo headless (invisível)
options.add_argument('--headless')
driver = webdriver.Chrome(service=service, options=options)
```

### 4. Faz Login (se necessário)

```python
if username and password:
    scraper.login(username, password)
```

### 5. Acessa Página de Busca

```python
search_url = f"{base_url}/c/busca?q={query}"
driver.get(search_url)
```

### 6. Aguarda Carregamento Dinâmico

```python
time.sleep(4)  # Aguarda JavaScript carregar
product_elements = driver.find_elements(By.CSS_SELECTOR, ".item-produto")
```

### 7. Extrai TODOS os Produtos

```python
# Sem limite - retorna todos
for element in product_elements:  # Não tem [:10] ou [:15]
    # Extrair nome, preço, SKU, imagem, disponibilidade...
    offers.append(ProductOffer(...))
```

### 8. Retorna JSON

```json
{
  "total_results": 15,
  "results": [...]  // Todos os 15 produtos
}
```

---

## 🔐 Segurança

### Credenciais Seguras

✅ **Nunca em logs**
```python
sanitized = credentials_manager.sanitize_for_logging(credentials)
logger.info(f"Credenciais: {sanitized}")  # password: ***HIDDEN***
```

✅ **Nunca na response**
```python
# Response NUNCA contém username/password
response = ProductSearchBySupplierResponse(
    product_name=...,
    results=...
    # SEM username/password
)
```

✅ **Validação**
```python
if not credentials_manager.validate_credentials(username, password):
    raise HTTPException(400, "Credenciais inválidas")
```

✅ **Criptografia (opcional)**
```python
encrypted = credentials_manager.encrypt_password(password)
# Armazenar 'encrypted' no banco de dados
```

---

## 📊 Informações Extraídas

Cada produto retorna:

| Campo | Tipo | Sempre Disponível? |
|-------|------|-------------------|
| `product_name` | string | ✅ Sim |
| `price` | float | ✅ Sim |
| `product_url` | string | ✅ Sim |
| `store` | string | ✅ Sim |
| `availability` | string | ✅ Sim |
| `score` | float | ✅ Sim (similaridade) |
| `sku` | string | ⚠️ Se disponível no site |
| `image_url` | string | ⚠️ Se disponível no site |
| `description` | string | ⚠️ Se disponível no site |
| `brand` | string | ⚠️ Se disponível no site |

---

## 🧪 Testar

### 1. Verificar Health Check

```bash
curl http://localhost:8000/api/health
```

**Resposta esperada:**
```json
{"status": "ok", "service": "ConstruPrice API"}
```

### 2. Testar Busca Simples

```bash
curl -X POST "http://localhost:8000/api/search-by-supplier" \
  -H "Content-Type: application/json" \
  -d '{
    "product_name": "Cimento",
    "supplier_id": "test_001",
    "supplier_name": "Cofema Materiais"
  }'
```

### 3. Executar Script de Exemplo

```bash
python example_search_by_supplier.py
```

---

## 🆕 Fornecedores Suportados

| Fornecedor | Nome para API | Requer Login? |
|------------|---------------|---------------|
| Estoque Megaleste | `Estoque Megaleste` ou `megaleste` | ✅ Sim |
| Cofema Materiais | `Cofema Materiais` ou `cofema` | ❌ Não |
| Estoque Atacadista | `Estoque Atacadista` ou `estoque_atacadista` | ✅ Sim |

---

## 🛠️ Troubleshooting

### Problema: "Nenhum produto encontrado"

**Causa**: Seletores CSS do scraper podem estar desatualizados

**Solução**:
1. Abra o site do fornecedor no navegador
2. Inspecione os elementos (F12)
3. Atualize os seletores em `app/scrapers/{fornecedor}_scraper.py`

### Problema: "Login falhou"

**Causa**: Credenciais incorretas ou site mudou formulário

**Solução**:
1. Verifique credenciais no `.env`
2. Teste login manual no site
3. Atualize seletores de login no scraper

### Problema: "Timeout"

**Causa**: Site demorou para carregar

**Solução**:
```env
SCRAPING_TIMEOUT=30  # Aumentar timeout
```

---

## 📈 Próximas Melhorias

- [ ] Integração com banco de dados para credenciais
- [ ] Paginação de resultados muito grandes
- [ ] Cache de resultados recentes
- [ ] Webhook para notificação quando scraping terminar
- [ ] Adicionar mais fornecedores
- [ ] Suporte a filtros (preço min/max, disponibilidade)

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte **[SEARCH_BY_SUPPLIER_API.md](backend/SEARCH_BY_SUPPLIER_API.md)**
2. Execute **[example_search_by_supplier.py](backend/example_search_by_supplier.py)** para exemplos
3. Verifique logs do servidor em tempo real

---

**Desenvolvido com ❤️ para automatizar busca de produtos e comparação de preços**
