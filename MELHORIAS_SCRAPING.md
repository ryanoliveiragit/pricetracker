# 🚀 Melhorias Implementadas no Web Scraping

## 📋 Problemas Identificados e Resolvidos

### ❌ Problema 1: "Nenhuma credencial/loja ativa foi enviada pelo frontend"
**Causa**: O endpoint `/api/search` exigia que o frontend enviasse as lojas com credenciais. Se não enviasse, não executava scraping.

**✅ Solução**:
- Endpoint agora busca **automaticamente** credenciais do `.env` se o frontend não enviar
- Sistema funciona em 2 modos:
  - **Modo 1**: Frontend envia lojas → usa credenciais do frontend
  - **Modo 2**: Frontend não envia lojas → busca credenciais do `.env` automaticamente

### ❌ Problema 2: Login não estava acontecendo
**Causa**: Mesmo com credenciais no `.env`, o scraper não estava usando

**✅ Solução**:
- Integrado `CredentialsManager` no fluxo de busca
- Credenciais carregadas automaticamente de:
  - `SUPPLIER_ESTOQUE_MEGALESTE_USERNAME`
  - `SUPPLIER_ESTOQUE_MEGALESTE_PASSWORD`
  - etc.

### ❌ Problema 3: Produtos não eram encontrados (mesmo existindo)
**Causas múltiplas**:
1. `time.sleep()` fixo não esperava carregamento dinâmico
2. Produtos com lazy-loading não carregavam
3. Um único seletor CSS falhava se o site mudasse
4. Falta de logs para debug

**✅ Soluções Implementadas**:

#### 1. WebDriverWait ao invés de sleep fixo
```python
# ❌ Antes (ruim)
time.sleep(4)

# ✅ Agora (bom)
WebDriverWait(self.driver, 15).until(
    lambda d: d.find_elements(By.CSS_SELECTOR, ".item-produto")
)
```

#### 2. Scroll automático para lazy-loading
```python
def _scroll_to_load_all_products(self):
    for i in range(3):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.5)
```

#### 3. Múltiplos seletores CSS como fallback
```python
# Tenta múltiplos seletores até encontrar
selectors = [".item-produto", ".produto-item", "[data-product]", ".product-card"]
for selector in selectors:
    product_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
    if product_elements:
        break
```

#### 4. Logs detalhados com emojis para fácil identificação
```python
logger.info("🔍 Iniciando scraping...")
logger.info("✅ Login bem-sucedido")
logger.warning("⚠️  Timeout ao carregar")
logger.error("❌ Erro crítico")
```

#### 5. Screenshots e HTML para debug
```python
# Se falhar, salva evidências
self.driver.save_screenshot(f"debug_megaleste_{timestamp}.png")
with open(f"debug_megaleste_{timestamp}.html", 'w') as f:
    f.write(self.driver.page_source)
```

---

## 🎯 Arquivo Modificado: `megaleste_scraper.py`

### Melhorias Implementadas:

| Recurso | Antes | Depois |
|---------|-------|--------|
| **Espera de elementos** | `time.sleep(4)` fixo | `WebDriverWait` dinâmico |
| **Lazy-loading** | ❌ Não tratado | ✅ Scroll automático 3x |
| **Seletores CSS** | 1 único seletor | 4+ seletores como fallback |
| **Logs** | Mínimos | Detalhados com emojis 📊 |
| **Debug** | Sem ferramentas | Screenshots + HTML dump |
| **Timeout** | 10s | 20s (mais robusto) |
| **Tratamento de erro** | Aborta se login falha | Continua sem login |
| **Extração de dados** | Nome + preço | Nome + preço + SKU + imagem |

---

## 🔧 Arquivo Modificado: `search.py` (endpoint)

### Mudanças na função `search_all_stores()`:

```python
# ❌ ANTES: Retornava vazio se frontend não enviasse lojas
if store_credentials:
    # processar
else:
    logger.warning("Nenhuma loja ativa")
    return []  # ❌ Ruim!

# ✅ AGORA: Busca automaticamente do .env
if store_credentials:
    # OPÇÃO 1: Usar lojas do frontend
    ...
else:
    # OPÇÃO 2: Buscar do .env automaticamente
    for store_name, scraper_class in scraper_mapping.items():
        creds = credentials_manager.get_credentials(
            supplier_id=f"auto_{store_name}",
            supplier_name=store_name
        )
        scrapers.append((scraper_class, creds))
```

### Logs adicionados:
- `"✅ Credenciais encontradas para Estoque Megaleste"`
- `"ℹ️  Cofema será consultado sem login"`
- `"Total de scrapers a executar: 3"`
- `"Total de ofertas encontradas: 15"`

---

## 🧪 Como Testar

### 1. Reiniciar o servidor
```bash
# Ctrl+C para parar
python main.py
```

### 2. Testar do frontend
Fazer uma busca normal. Agora você verá nos logs:

```
2026-03-17 ... INFO - Frontend não enviou lojas. Buscando credenciais do .env automaticamente...
2026-03-17 ... INFO - ✅ Credenciais encontradas para Estoque Megaleste
2026-03-17 ... INFO - ℹ️  Cofema Materiais será consultado sem login
2026-03-17 ... INFO - Total de scrapers a executar: 3
2026-03-17 ... INFO - 🔍 Iniciando scraping em Estoque Megaleste para: 'cadeado'
2026-03-17 ... INFO - 🔐 Credenciais fornecidas. Tentando login...
2026-03-17 ... INFO - ✅ Menu de usuário aberto
2026-03-17 ... INFO - ✅ Credenciais preenchidas
2026-03-17 ... INFO - ✅ Botão de login clicado
2026-03-17 ... INFO - ✅ Login finalizado com sucesso
2026-03-17 ... INFO - 📡 Acessando: https://www.megaleste.com.br/c/busca?q=cadeado
2026-03-17 ... INFO - ✅ Página carregada
2026-03-17 ... INFO - 📜 Fazendo scroll para carregar produtos dinâmicos...
2026-03-17 ... INFO - ✅ Encontrados 12 produtos usando seletor: .item-produto
2026-03-17 ... INFO - 🔄 Processando 12 produtos...
2026-03-17 ... INFO - ✅ Estoque Megaleste: 12 produtos válidos encontrados
2026-03-17 ... INFO - Total de ofertas encontradas: 12
```

### 3. Se ainda não encontrar produtos
Os logs dirão exatamente o que aconteceu:
- `"⏱️  Timeout - página demorou muito"` → Site está lento
- `"⚠️  Nenhum produto encontrado na página"` → Seletor CSS mudou
- `"📸 Screenshot salvo: debug_megaleste_xxx.png"` → Confira o screenshot
- `"📄 HTML salvo: debug_megaleste_xxx.html"` → Inspecione o HTML

---

## 📊 Resultados Esperados

### Antes (❌ Ruim):
```json
{
  "items": [
    {
      "raw_query": "cadeado",
      "offers": []  // ❌ Vazio!
    }
  ]
}
```

### Agora (✅ Bom):
```json
{
  "items": [
    {
      "raw_query": "cadeado",
      "offers": [
        {
          "store": "Estoque Megaleste",
          "product_name": "Cadeado Papaiz 40mm",
          "price": 15.90,
          "product_url": "https://...",
          "sku": "CAD-PAP-40",
          "image_url": "https://...",
          "availability": "em_estoque",
          "score": 0.95
        },
        // ... mais produtos
      ]
    }
  ],
  "total_items": 1,
  "stores": ["Estoque Megaleste", "Cofema Materiais"]
}
```

---

## 🔍 Debug em Caso de Problemas

### Se produtos não aparecerem:

1. **Verificar logs do servidor**:
   - Procure por "❌" (erros)
   - Procure por "⚠️" (warnings)

2. **Verificar screenshots salvos**:
   ```bash
   ls debug_megaleste_*.png
   ```
   Abra a imagem e veja o que o Selenium estava "vendo"

3. **Verificar HTML salvo**:
   ```bash
   cat debug_megaleste_*.html | grep -i "produto\|product"
   ```
   Veja se os produtos estão no HTML

4. **Testar manualmente no navegador**:
   - Abra: `https://www.megaleste.com.br/c/busca?q=cadeado`
   - Inspecione (F12) e veja os seletores CSS dos produtos
   - Atualize os seletores em `megaleste_scraper.py` se necessário

---

## 🎓 Conceitos Aplicados

### 1. **Espera Explícita vs Implícita**
- ❌ `time.sleep(4)` = espera implícita (sempre 4s, mesmo se carregar em 1s)
- ✅ `WebDriverWait` = espera explícita (aguarda até condição, max 15s)

### 2. **Lazy Loading**
- Sites modernos não carregam todos os produtos de uma vez
- Scroll automático "engana" o site para carregar tudo

### 3. **Graceful Degradation**
- Se login falhar → continua sem login
- Se seletor `.item-produto` falhar → tenta `.produto-item`
- Se preço não for encontrado → pula produto (não trava tudo)

### 4. **Observabilidade**
- Logs detalhados = facilita debug
- Screenshots = "foto" do problema
- HTML dump = análise offline

---

## 🚀 Próximos Passos (Opcional)

### Melhorias Futuras:
1. ✅ **Playwright ao invés de Selenium** (mais rápido, mais moderno)
2. ✅ **Cache de produtos** (não fazer scraping toda vez)
3. ✅ **Retry automático** (tentar 2-3x se falhar)
4. ✅ **Proxy rotation** (evitar bloqueios)
5. ✅ **Captcha solver** (resolver captchas automaticamente)

### Para Implementar Agora:
```python
# Adicionar retry automático
from tenacity import retry, stop_after_attempt, wait_fixed

@retry(stop=stop_after_attempt(3), wait=wait_fixed(5))
def search(self, query, username, password):
    # ... código atual
```

---

## 📝 Checklist de Validação

Após reiniciar o servidor, verifique:

- [ ] Servidor inicia sem erros
- [ ] Busca do frontend não mostra "nenhuma credencial"
- [ ] Logs mostram "✅ Credenciais encontradas"
- [ ] Logs mostram "✅ Login finalizado com sucesso"
- [ ] Logs mostram "✅ Encontrados X produtos"
- [ ] Response JSON contém produtos (não vazio)
- [ ] Produtos têm nome, preço, URL

---

**Desenvolvido com ❤️ para resolver o problema de scraping**

Se ainda tiver problemas, consulte os arquivos de debug gerados! 🐛
