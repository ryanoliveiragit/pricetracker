# Guia Completo: Criação e Integração de Scrapers — ConstruPrice

> Documento destinado ao painel admin externo (`adminconstruct`).  
> Cobre todo o ciclo: criar o scraper em código → registrar → testar via API → vincular a um tenant.

---

## 1. Visão Geral da Arquitetura

```
Tenant (cliente)
  └── SupplierDB (fornecedor cadastrado no banco)
        └── nome do fornecedor → _resolve_scraper() → ScraperClass
              └── ScraperClass.search(query, username, password)
                    └── retorna List[ProductOffer]
```

O vínculo entre um fornecedor e seu scraper é feito **pelo nome**: o campo `name` do `SupplierDB` deve conter uma das palavras-chave registradas em `_get_scraper_map()` (ex: `"cofema"`, `"megaleste"`, `"atacadista"`).

---

## 2. Estrutura de Arquivos

```
backend/
  app/
    scrapers/
      base_scraper.py              ← interface base (não editar)
      cofema_scraper.py            ← exemplo: scraper com login (requests)
      estoque_atacadista_scraper.py ← exemplo: scraper com login (requests + BS4)
      megaleste_scraper.py         ← exemplo: scraper público (sem login)
      superabc_scraper.py          ← exemplo: scraper público (sem login)
      meu_novo_scraper.py          ← NOVO SCRAPER aqui
    api/
      routes/
        suppliers.py               ← registrar o scraper aqui (_get_scraper_map)
```

---

## 3. Interface Obrigatória (BaseScraper)

Todo scraper herda de `BaseScraper` e implementa **obrigatoriamente**:

```python
def search(
    self,
    query: str,
    username: str = "",
    password: str = "",
    region: str = "sp"
) -> List[ProductOffer]:
    ...
```

Opcionalmente sobrescreve (apenas se o site exigir login):

```python
def login(self, username: str, password: str) -> bool:
    ...
```

**Atributos obrigatórios após login:**
| Atributo | Tipo | Descrição |
|---|---|---|
| `self.is_logged_in` | `bool` | `True` somente após login bem-sucedido |
| `self.login_error` | `str \| None` | Mensagem de erro legível para o usuário |
| `self.session` | `requests.Session` | Sessão HTTP que mantém cookies |

---

## 4. Modelo de Retorno: ProductOffer

Cada item retornado pelo `search()` deve ser um `ProductOffer`:

```python
from app.models.product import ProductOffer

ProductOffer(
    store="Nome da Loja",          # str — aparece nos resultados
    product_name="Cimento CP2 50kg", # str — nome exato no site
    price=89.90,                   # float — sem R$, sem formatação
    currency="BRL",                # sempre "BRL"
    availability="em_estoque",     # "em_estoque" | "indisponivel" | "sob_consulta"
    product_url="https://...",     # URL completa do produto
    image_url="https://...",       # URL da imagem (pode ser "")
    sku="",                        # código do produto (pode ser "")
    brand="",                      # marca (pode ser "")
    unit="un",                     # unidade: "un", "kg", "m", "cx" etc.
)
```

---

## 5. Scraper SEM Login (site público)

```python
# backend/app/scrapers/minha_loja_scraper.py

import requests
from bs4 import BeautifulSoup
from typing import List, Optional
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

BASE_URL = "https://www.minhaloja.com.br"

class MinhaLojaScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Minha Loja", base_url=BASE_URL)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

    def search(self, query: str, username: str = "", password: str = "", region: str = "sp") -> List[ProductOffer]:
        try:
            url = f"{BASE_URL}/busca?q={requests.utils.quote(query)}"
            r = self.session.get(url, timeout=10)
            r.raise_for_status()

            soup = BeautifulSoup(r.text, "html.parser")
            offers = []

            # Inspecione o HTML do site e ajuste os seletores:
            for card in soup.select(".produto-card"):           # <-- seletor do container de produto
                name = card.select_one(".produto-nome")        # <-- seletor do nome
                price_el = card.select_one(".produto-preco")   # <-- seletor do preço
                link = card.select_one("a")                    # <-- seletor do link

                if not name or not price_el:
                    continue

                offers.append(ProductOffer(
                    store=self.store_name,
                    product_name=name.get_text(strip=True),
                    price=self._extract_price(price_el.get_text(strip=True)),
                    currency="BRL",
                    availability="em_estoque",
                    product_url=BASE_URL + link["href"] if link else "",
                    image_url="",
                    sku="",
                    brand="",
                    unit="un",
                ))

            return self._rank_results(query, offers)

        except Exception as e:
            self.record_failure()
            return []
```

---

## 6. Scraper COM Login (credenciais por tenant)

```python
# backend/app/scrapers/loja_privada_scraper.py

import requests
import time
from bs4 import BeautifulSoup
from typing import List, Optional
from app.scrapers.base_scraper import BaseScraper
from app.models.product import ProductOffer

BASE_URL = "https://www.lojaprivada.com.br"
CACHE_KEY = "lojaPrivada"  # chave única para cache de sessão

class LojaPrivadaScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Loja Privada", base_url=BASE_URL)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        self.is_logged_in = False
        self.login_error: Optional[str] = None

    # ─── LOGIN ────────────────────────────────────────────────────────────────

    def login(self, username: str, password: str) -> bool:
        """
        Passo 1: GET na página de login (captura CSRF token, cookies iniciais)
        Passo 2: POST com credenciais
        Passo 3: Verificar se o login foi bem-sucedido
        """
        try:
            # 1. Carregar página de login
            r = self.session.get(f"{BASE_URL}/login", timeout=15)
            r.raise_for_status()

            soup = BeautifulSoup(r.text, "html.parser")

            # Capturar token CSRF (inspecione o HTML para encontrar o campo)
            csrf_input = soup.find("input", {"name": "_token"})       # ajuste o name conforme o site
            csrf = csrf_input["value"] if csrf_input else ""

            # 2. Enviar credenciais
            time.sleep(1)  # evita rate limit
            resp = self.session.post(
                f"{BASE_URL}/login",
                data={
                    "_token": csrf,
                    "email": username,      # ajuste o name do campo conforme o site
                    "password": password,   # ajuste o name do campo conforme o site
                },
                headers={"Referer": f"{BASE_URL}/login"},
                timeout=15,
                allow_redirects=True,
            )

            # 3. Verificar sucesso
            # OPÇÃO A — checar URL (OpenCart, Laravel etc.):
            if "login" in resp.url:
                self.login_error = "Usuário ou senha inválidos"
                return False

            # OPÇÃO B — checar elemento HTML (link de logout/perfil):
            soup_resp = BeautifulSoup(resp.text, "html.parser")
            logout = soup_resp.find("a", href=lambda h: h and "logout" in str(h))
            if not logout:
                self.login_error = "Usuário ou senha inválidos"
                return False

            # OPÇÃO C — checar resposta JSON (APIs que retornam JSON):
            # data = resp.json()
            # if not data.get("success"):
            #     self.login_error = data.get("message", "Login falhou")
            #     return False

            self.is_logged_in = True
            return True

        except Exception as e:
            self.login_error = f"Erro de conexão: {e}"
            return False

    # ─── SEARCH ───────────────────────────────────────────────────────────────

    def search(self, query: str, username: str = "", password: str = "", region: str = "sp") -> List[ProductOffer]:
        from app.services.session_cache import get_session, store_session, get_login_lock

        # Recuperar sessão em cache ou fazer novo login
        if username and password:
            cached = get_session(CACHE_KEY, username)
            if cached:
                self.session = cached
                self.is_logged_in = True
            else:
                with get_login_lock(CACHE_KEY):
                    cached = get_session(CACHE_KEY, username)
                    if cached:
                        self.session = cached
                        self.is_logged_in = True
                    else:
                        if self.login(username, password) and self.is_logged_in:
                            store_session(CACHE_KEY, username, self.session)

        if not self.is_logged_in:
            return []

        try:
            url = f"{BASE_URL}/busca?q={requests.utils.quote(query)}"
            r = self.session.get(url, timeout=10)
            r.raise_for_status()

            soup = BeautifulSoup(r.text, "html.parser")
            offers = []

            for card in soup.select(".produto"):          # ajuste o seletor
                name = card.select_one(".nome")
                price_el = card.select_one(".preco")
                link = card.select_one("a")

                if not name or not price_el:
                    continue

                offers.append(ProductOffer(
                    store=self.store_name,
                    product_name=name.get_text(strip=True),
                    price=self._extract_price(price_el.get_text(strip=True)),
                    currency="BRL",
                    availability="em_estoque",
                    product_url=BASE_URL + link["href"] if link else "",
                    image_url="",
                    sku="",
                    brand="",
                    unit="un",
                ))

            return self._rank_results(query, offers)

        except Exception as e:
            self.record_failure()
            return []
```

---

## 7. Como Identificar os Campos HTML (DevTools)

### Passo a passo no navegador

1. Abra o site do fornecedor
2. Pressione `F12` → aba **Elements**
3. Clique no ícone de cursor (🔲) e clique no elemento desejado (preço, nome, etc.)
4. O HTML do elemento aparece destacado no painel

### O que procurar

| O que você quer | O que inspecionar |
|---|---|
| Container do produto | `div`, `li`, `article` que se repete para cada item |
| Nome do produto | Elemento com o título do produto (`h2`, `span`, `a`) |
| Preço | Elemento com classe como `.price`, `.preco`, `.valor` |
| Link do produto | Tag `<a href="...">` dentro do container |
| Imagem | Tag `<img src="...">` dentro do container |
| Campo de login | Formulário `<form>` na página de login — inspecione `name` dos `<input>` |
| Token CSRF | `<input type="hidden" name="_token">` ou `name="__RequestVerificationToken"` |

### Dica: testar seletores no console

```javascript
// No console do DevTools (F12 → Console):
document.querySelectorAll(".produto-card")        // lista todos os cards
document.querySelector(".produto-card .preco")    // primeiro preço
```

### Dica: verificar se o login funcionou

Após fazer login manualmente no site, inspecione:
- A URL muda? (ex: vai de `/login` para `/minha-conta`)
- Aparece link de "Sair" / "Logout" no menu?
- A resposta é JSON? (aba Network → XHR → Response)

---

## 8. Registrar o Scraper no Sistema

Após criar o arquivo do scraper, registre-o em **`backend/app/api/routes/suppliers.py`**:

```python
def _get_scraper_map() -> dict:
    global _SCRAPER_MAP
    if _SCRAPER_MAP is None:
        from app.scrapers.cofema_scraper import CofemaScraper
        from app.scrapers.estoque_atacadista_scraper import EstoqueAtacadistaScraper
        from app.scrapers.megaleste_scraper import MegalesteScraper
        from app.scrapers.superabc_scraper import SuperABCScraper
        from app.scrapers.minha_loja_scraper import MinhaLojaScraper   # ← NOVO

        _SCRAPER_MAP = {
            "megaleste":   (MegalesteScraper,         "megaleste"),
            "cofema":      (CofemaScraper,             "cofema"),
            "atacadista":  (EstoqueAtacadistaScraper,  "estoqueAtacadista"),
            "super abc":   (SuperABCScraper,           "superabc"),
            "superabc":    (SuperABCScraper,           "superabc"),
            "minha loja":  (MinhaLojaScraper,          "minhaLoja"),   # ← NOVO
            #   ↑ palavra-chave (deve estar no campo "name" do fornecedor no banco)
        }
    return _SCRAPER_MAP
```

> **Regra de ouro**: a palavra-chave deve ser uma substring do `name` cadastrado no `SupplierDB`.  
> Ex: keyword `"minha loja"` → `SupplierDB.name = "Minha Loja Atacadista"` ✅

---

## 9. Testar o Scraper em Isolamento (sem API)

Crie um script de teste rápido em `backend/`:

```python
# backend/test_scraper.py
import asyncio
import sys
sys.path.insert(0, ".")

from app.scrapers.minha_loja_scraper import MinhaLojaScraper

scraper = MinhaLojaScraper()

# --- TESTE DE LOGIN (apenas se o scraper exige login) ---
USERNAME = "seu@email.com"
PASSWORD = "suasenha"

ok = scraper.login(USERNAME, PASSWORD)
print(f"Login: {'✅ OK' if ok else '❌ FALHOU'}")
if not ok:
    print(f"Erro: {scraper.login_error}")
    exit(1)

# --- TESTE DE BUSCA ---
resultados = scraper.search("cimento cp2 50kg", username=USERNAME, password=PASSWORD)
print(f"\nResultados ({len(resultados)}):")
for r in resultados[:5]:
    print(f"  {r.product_name} — R$ {r.price:.2f} — {r.product_url}")
```

Executar:
```bash
cd backend
python test_scraper.py
```

---

## 10. Fluxo Completo via API (sem tocar no código depois)

### 10.1 Criar o fornecedor no banco

```http
POST /api/admin/suppliers
Authorization: Bearer {super_admin_token}
Content-Type: application/json

{
  "name": "Minha Loja Atacadista",
  "url": "https://www.minhaloja.com.br",
  "requiresLogin": true,
  "region": "sp",
  "notes": "Atacadista de materiais de construção SP"
}
```

Resposta:
```json
{
  "id": "uuid-do-fornecedor",
  "name": "Minha Loja Atacadista",
  ...
}
```

> Guarde o `id` — usado nos passos seguintes.

### 10.2 Testar o login do scraper via API

```http
POST /api/suppliers/{supplier_id}/test-login
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "usuario@empresa.com",
  "password": "senha123"
}
```

Respostas possíveis:
```json
{ "ok": true,  "message": "Login realizado com sucesso" }
{ "ok": false, "message": "Usuário ou senha inválidos" }
{ "ok": false, "message": "Nenhum scraper mapeado para 'Minha Loja Atacadista'" }
{ "ok": false, "message": "Timeout ao tentar conectar — verifique se o site está acessível" }
```

> Se receber `"Nenhum scraper mapeado"`, verifique se a palavra-chave em `_get_scraper_map` é substring do `name` cadastrado.

### 10.3 Salvar as credenciais do fornecedor

```http
PATCH /api/suppliers/{supplier_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "usuario@empresa.com",
  "password": "senha123"
}
```

### 10.4 Vincular o fornecedor a um tenant

```http
POST /api/tenants/{tenant_id}/suppliers/{supplier_id}
Authorization: Bearer {super_admin_token}
```

Resposta: `204 No Content` (sucesso)

### 10.5 Verificar fornecedores vinculados ao tenant

```http
GET /api/tenants/{tenant_id}/suppliers
Authorization: Bearer {super_admin_token}
```

### 10.6 Desvincular fornecedor de um tenant

```http
DELETE /api/tenants/{tenant_id}/suppliers/{supplier_id}
Authorization: Bearer {super_admin_token}
```

---

## 11. Checklist de Validação Antes de Vincular ao Tenant

- [ ] Script isolado (`test_scraper.py`) retorna resultados com preço > 0
- [ ] Login com credenciais erradas retorna `False` (não passa)
- [ ] Login com credenciais corretas retorna `True`
- [ ] Busca retorna pelo menos 1 resultado para um produto comum
- [ ] `product_url` são URLs absolutas (começam com `https://`)
- [ ] `price` é float numérico (sem `R$`, sem vírgula como decimal)
- [ ] Endpoint `POST /api/suppliers/{id}/test-login` retorna `ok: true`
- [ ] Endpoint foi registrado no `_get_scraper_map` com a palavra-chave correta
- [ ] Fornecedor criado no banco com `requiresLogin` correto
- [ ] Tenant vinculado via `POST /api/tenants/{tenant_id}/suppliers/{supplier_id}`

---

## 12. Referência Rápida de Endpoints

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/admin/suppliers` | super_admin | Listar todos os fornecedores |
| `POST` | `/api/admin/suppliers` | super_admin | Criar fornecedor |
| `PATCH` | `/api/admin/suppliers/{id}` | super_admin | Editar fornecedor |
| `DELETE` | `/api/admin/suppliers/{id}` | super_admin | Deletar fornecedor |
| `POST` | `/api/suppliers/{id}/test-login` | token | Testar login do scraper |
| `PATCH` | `/api/suppliers/{id}` | token | Salvar credenciais |
| `GET` | `/api/tenants/{id}/suppliers` | super_admin | Fornecedores do tenant |
| `POST` | `/api/tenants/{id}/suppliers/{sid}` | super_admin | Vincular ao tenant |
| `DELETE` | `/api/tenants/{id}/suppliers/{sid}` | super_admin | Desvincular do tenant |

---

## 13. Problemas Comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `"Nenhum scraper mapeado"` | Palavra-chave não bate com o `name` | Ajustar keyword em `_get_scraper_map` |
| Login sempre falha | CSRF token não capturado | Inspecionar HTML da página de login novamente |
| Login sempre passa | Verificação pós-login fraca | Checar URL + elemento de logout |
| Busca retorna `[]` | Seletor CSS errado | Testar seletor no DevTools console |
| Preço = `0.0` | Formato de preço diferente | Ajustar `_extract_price` ou pré-processar o texto |
| Timeout | Site lento ou bloqueando | Aumentar `timeout`, adicionar `time.sleep(1)` entre requests |
| `404` no test-login | `supplier_id` incorreto | Usar o UUID retornado pelo `POST /api/admin/suppliers` |
