# 🔧 Correção dos Seletores CSS - Megaleste

## 🎯 Problema Encontrado

O scraper **estava encontrando** os produtos (verificado no debug HTML), mas **não estava extraindo** os dados corretamente porque os seletores CSS estavam errados.

## 📊 Análise do HTML Real

### Estrutura HTML da Megaleste:

```html
<div class="product-line product-65684" data-id="65684">
  <a href="https://www.megaleste.com.br/c/produto/65684" class="btn-modal show-lupa" title="CADEADO C/SEGREDO STAM 25">
    <img src="http://www.eletroleste.com.br/images/produtos/65684_2.jpg">
  </a>
  <div class="product-content">
    <h4>CADEADO C/SEGREDO STAM 25</h4>
    <small>Cód. 65684 Emb.: PC0020/001</small>
  </div>
  <div class="price">
    <small><strike>R$ 14,070</strike></small>
    <span class="text-danger font-weight-bold">R$ 12,290</span>
  </div>
  <input type="text" name="qtd" placeholder="0" value="">
  <button type="button" class="btn btn-cart-add btn-primary">Adic.</button>
</div>
```

## ✅ Correções Aplicadas

### 1. Seletor do Container de Produto

| Antes (❌) | Depois (✅) |
|-----------|------------|
| `.item-produto` | `.product-line` |
| `.produto-item` | `.product-line` |

```python
# ❌ ANTES
product_elements = self.driver.find_elements(By.CSS_SELECTOR, ".item-produto")

# ✅ AGORA
selectors = [
    ".product-line",      # ✅ Correto para Megaleste
    ".item-produto",      # Fallback para outros sites
    ".produto-item"
]
```

### 2. Seletor do Nome do Produto

| Antes (❌) | Depois (✅) |
|-----------|------------|
| `h4` | `.product-content h4` |

```python
# ❌ ANTES
name_elem = element.find_element(By.CSS_SELECTOR, "h4")

# ✅ AGORA
name_elem = element.find_element(By.CSS_SELECTOR, ".product-content h4")
```

### 3. Seletor do Preço

| Antes (❌) | Depois (✅) |
|-----------|------------|
| `.price-red` | `.price span.text-danger` |
| `.precos span:last-child` | `.price span:last-child` |

```python
# ❌ ANTES
price_elem = element.find_element(By.CSS_SELECTOR, ".price-red")

# ✅ AGORA
price_selectors = [
    ".price span.text-danger",  # Preço com desconto
    ".price span:last-child"     # Preço normal
]
```

### 4. Seletor da URL do Produto

| Antes (❌) | Depois (✅) |
|-----------|------------|
| `a.btn-modal.show-lupa` (sem espaço) | `a.btn-modal.show-lupa` OU `data-id` |

```python
# ✅ AGORA com fallback
link_elem = element.find_element(By.CSS_SELECTOR, "a.btn-modal.show-lupa")
# OU
product_id = element.get_attribute('data-id')
product_url = f"{self.base_url}/c/produto/{product_id}"
```

### 5. Extração do SKU

| Antes (❌) | Depois (✅) |
|-----------|------------|
| `.codigo, .sku` | `data-id` OU regex em `.product-content small` |

```python
# ✅ AGORA
# Opção 1: Pegar do atributo data-id
sku = element.get_attribute('data-id')  # "65684"

# Opção 2: Extrair do texto "Cód. 65684 Emb.: PC0020/001"
small_text = element.find_element(By.CSS_SELECTOR, ".product-content small").text
match = re.search(r'Cód\.\s*(\d+)', small_text)
if match:
    sku = match.group(1)  # "65684"
```

### 6. WebDriverWait Atualizado

```python
# ✅ AGORA aguarda .product-line também
WebDriverWait(self.driver, 15).until(
    lambda d: d.find_elements(By.CSS_SELECTOR, ".product-line, .item-produto, .produto-item")
)
```

---

## 📝 Resumo das Mudanças

| Elemento | Seletor Anterior | Seletor Novo | Status |
|----------|-----------------|--------------|--------|
| Container | `.item-produto` | `.product-line` | ✅ Corrigido |
| Nome | `h4` | `.product-content h4` | ✅ Corrigido |
| Preço | `.price-red` | `.price span.text-danger` | ✅ Corrigido |
| Link | `a` genérico | `a.btn-modal.show-lupa` | ✅ Corrigido |
| SKU | `.codigo` | `data-id` + regex | ✅ Corrigido |
| Imagem | `img` | `img` | ✅ Já funcionava |

---

## 🧪 Como Testar

### 1. Limpar arquivos de debug antigos
```bash
cd backend
rm debug_megaleste_*
```

### 2. Reiniciar o servidor
```bash
python main.py
```

### 3. Fazer busca do frontend
Buscar por "cadeado"

### 4. Verificar logs
Agora você deve ver:
```
✅ Encontrados 6 produtos usando seletor: .product-line
🔄 Processando 6 produtos...
✅ Produto 1: CADEADO C/SEGREDO STAM 25 - R$ 12.29
✅ Produto 2: CADEADO C/SEGREDO STAM 40 - R$ 24.59
✅ Estoque Megaleste: 6 produtos válidos encontrados
Total de ofertas encontradas: 6
```

### 5. Verificar response
```json
{
  "items": [
    {
      "raw_query": "cadeado",
      "offers": [
        {
          "store": "Estoque Megaleste",
          "product_name": "CADEADO C/SEGREDO STAM 25",
          "price": 12.29,
          "product_url": "https://www.megaleste.com.br/c/produto/65684",
          "sku": "65684",
          "image_url": "http://www.eletroleste.com.br/images/produtos/65684_2.jpg",
          "availability": "em_estoque",
          "score": 0.95
        }
      ]
    }
  ]
}
```

---

## 🔍 Debug Files Úteis

Se ainda tiver problemas, os arquivos de debug mostrarão:

### Screenshot (debug_megaleste_XXX.png)
- Como o Selenium "vê" a página
- Se produtos estão visíveis

### HTML (debug_megaleste_XXX.html)
- Estrutura completa do HTML
- Permite inspecionar seletores CSS
- Use `grep` para buscar classes:
  ```bash
  cat debug_megaleste_*.html | grep -i "product-line\|cadeado"
  ```

---

## ✅ Checklist de Validação

Após reiniciar:

- [ ] Servidor inicia sem erros
- [ ] Logs mostram "✅ Encontrados X produtos usando seletor: .product-line"
- [ ] Logs mostram "✅ Produto 1: NOME - R$ PREÇO"
- [ ] Logs mostram "✅ Estoque Megaleste: X produtos válidos encontrados"
- [ ] Logs mostram "Total de ofertas encontradas: X" (X > 0)
- [ ] Response JSON contém array `offers` com produtos
- [ ] Cada produto tem: name, price, product_url, sku, image_url

---

## 🎯 Resultado Esperado

Agora o scraper deve:
1. ✅ Encontrar os produtos (`.product-line`)
2. ✅ Extrair o nome (`.product-content h4`)
3. ✅ Extrair o preço (`.price span.text-danger`)
4. ✅ Extrair a URL (`a.btn-modal.show-lupa` href)
5. ✅ Extrair o SKU (`data-id` ou regex)
6. ✅ Extrair a imagem (`img` src)
7. ✅ Retornar produtos no JSON

**Teste agora!** 🚀
