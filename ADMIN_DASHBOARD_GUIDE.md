# Admin Dashboard - Guia Completo

## Todos os Endpoints da API (55 endpoints)

### Auth (2)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login tenant user |
| POST | `/api/auth/super-admin/login` | Login super admin |

### Users (8)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/users/me` | Perfil do usuario logado |
| PATCH | `/api/users/me` | Atualizar perfil |
| GET | `/api/users` | Listar usuarios do tenant |
| POST | `/api/users` | Criar usuario (admin+) |
| GET | `/api/users/{id}` | Detalhe do usuario |
| PATCH | `/api/users/{id}` | Atualizar usuario (admin+) |
| DELETE | `/api/users/{id}` | Deletar usuario (admin+) |
| PATCH | `/api/users/{id}/toggle-status` | Ativar/desativar (admin+) |

### Products (9)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/products` | Listar produtos |
| POST | `/api/products` | Criar produto |
| GET | `/api/products/{id}` | Detalhe do produto |
| PATCH | `/api/products/{id}` | Atualizar produto |
| PATCH | `/api/products/{id}/variants` | Atualizar variantes |
| DELETE | `/api/products/{id}` | Deletar produto |
| POST | `/api/products/import-csv` | Importar CSV em massa |
| POST | `/api/products/{id}/generate-variants` | Gerar variantes com IA |
| POST | `/api/products/suggest-variants` | Sugerir variantes por nome |

### Suppliers (5)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/suppliers` | Listar fornecedores |
| POST | `/api/suppliers` | Criar fornecedor |
| GET | `/api/suppliers/{id}` | Detalhe do fornecedor |
| PATCH | `/api/suppliers/{id}` | Atualizar fornecedor |
| DELETE | `/api/suppliers/{id}` | Deletar fornecedor |

### Search (3)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/search` | Buscar em todos fornecedores |
| POST | `/api/search/stream` | Busca streaming (SSE) |
| POST | `/api/search-by-supplier` | Buscar em 1 fornecedor |

### Saves (3)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/saves` | Listar ofertas salvas |
| POST | `/api/saves` | Salvar oferta |
| DELETE | `/api/saves/{id}` | Remover oferta salva |

### Feedback (10)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/feedback` | Enviar feedback (multipart) |
| GET | `/api/feedback` | Listar feedbacks (admin) |
| GET | `/api/feedback/{id}` | Detalhe do feedback (admin) |
| POST | `/api/feedback/{id}/reanalyze` | Re-analisar com IA |
| PATCH | `/api/feedback/{id}/prompt` | Editar prompt da IA |
| POST | `/api/feedback/{id}/validate` | Validar feedback |
| POST | `/api/feedback/{id}/execute` | Criar branch no GitHub |
| POST | `/api/feedback/{id}/merge` | Marcar como merged |
| POST | `/api/feedback/{id}/reject` | Rejeitar feedback |
| POST | `/api/feedback/{id}/chat` | Chat com IA sobre feedback |

### Agent (1)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/agent/chat` | Agente interativo de pedidos |

### Tenants (8)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/tenant/me` | Info do tenant atual |
| POST | `/api/tenants/signup` | Signup publico |
| GET | `/api/tenants/check-slug` | Verificar slug disponivel |
| GET | `/api/tenants` | Listar tenants (super admin) |
| POST | `/api/tenants` | Criar tenant (super admin) |
| PATCH | `/api/tenants/{id}` | Atualizar tenant (super admin) |
| DELETE | `/api/tenants/{id}` | Deletar tenant (super admin) |
| POST | `/api/tenants/{id}/users` | Criar admin do tenant |

### Admin/Infra (4)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/admin/scraper-sessions` | Listar sessoes Selenium |
| DELETE | `/api/admin/scraper-sessions/{key}` | Deletar sessao |
| DELETE | `/api/admin/scraper-sessions` | Limpar todas sessoes |
| POST | `/api/admin/reseed-suppliers` | Re-popular fornecedores |

### Health (2)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|

| GET | `/health` | Health check |
| GET | `/` | Info da API |

---

## Paginas do Dashboard Admin

### 1. `/admin` - Dashboard Overview
**O que mostrar:**
- Cards com metricas principais:
  - Total de usuarios ativos
  - Total de produtos cadastrados
  - Total de fornecedores ativos
  - Total de buscas recentes (cache hits)
  - Feedbacks pendentes
- Grafico de buscas por dia (ultimos 7 dias)
- Ultimos feedbacks recebidos (lista resumida)
- Status dos scrapers (online/offline)
- Sessoes Selenium ativas

**Endpoints usados:**
- `GET /api/users` (count)
- `GET /api/products` (count)
- `GET /api/suppliers` (count)
- `GET /api/feedback` (pendentes)
- `GET /api/admin/scraper-sessions`

---

### 2. `/admin/users` - Gestao de Usuarios
**O que mostrar:**
- Tabela com: nome, email, role, status (ativo/inativo), data criacao
- Filtros: por role, por status
- Acoes: criar, editar, ativar/desativar, deletar
- Modal de criacao/edicao com campos: nome, email, senha, role

**Endpoints usados:**
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/{id}`
- `DELETE /api/users/{id}`
- `PATCH /api/users/{id}/toggle-status`

---

### 3. `/admin/products` - Catalogo de Produtos
**O que mostrar:**
- Tabela com: nome, categoria, marca, unidade, SKU, num variantes
- Busca por nome/SKU
- Filtros: por categoria, por marca
- Acoes: criar, editar, deletar, gerar variantes IA
- Botao de importar CSV (drag & drop)
- Modal de variantes (editar/gerar com IA)

**Endpoints usados:**
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/{id}`
- `DELETE /api/products/{id}`
- `POST /api/products/import-csv`
- `POST /api/products/{id}/generate-variants`
- `POST /api/products/suggest-variants`
- `PATCH /api/products/{id}/variants`

---

### 4. `/admin/suppliers` - Fornecedores
**O que mostrar:**
- Cards ou tabela com: nome, URL, logo, regiao, status (ativo/inativo), requer login
- Indicador de saude (ultimo scrape bem sucedido)
- Acoes: criar, editar, deletar
- Modal de edicao com campos de credenciais (username/password)
- Botao "Testar Conexao"

**Endpoints usados:**
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PATCH /api/suppliers/{id}`
- `DELETE /api/suppliers/{id}`

---

### 5. `/admin/feedback` - Central de Feedbacks
**O que mostrar:**
- Pipeline Kanban com colunas:
  - Pendente → Analisado → Validado → Executando → Deployed → Merged
  - + coluna Rejeitado
- Cada card: tipo (bug/sugestao/melhoria), titulo, prioridade, data
- Detalhe do feedback: analise IA, prompt editavel, acoes
- Botoes de acao por status:
  - Pendente: "Analisar com IA"
  - Analisado: "Validar" / "Rejeitar" / "Editar Prompt" / "Re-analisar"
  - Validado: "Executar (criar branch)"
  - Executando: "Marcar como Merged"
- Chat com IA integrado no detalhe

**Endpoints usados:**
- `GET /api/feedback`
- `GET /api/feedback/{id}`
- `POST /api/feedback/{id}/reanalyze`
- `PATCH /api/feedback/{id}/prompt`
- `POST /api/feedback/{id}/validate`
- `POST /api/feedback/{id}/execute`
- `POST /api/feedback/{id}/merge`
- `POST /api/feedback/{id}/reject`
- `POST /api/feedback/{id}/chat`

---

### 6. `/admin/scrapers` - Monitoramento de Scrapers
**O que mostrar:**
- Lista de scrapers com status (online/offline/erro)
- Sessoes Selenium ativas (browser instances)
- Botoes: limpar sessao individual, limpar todas
- Botao "Re-popular Fornecedores" (reseed)
- Log de ultimas execucoes (se disponivel)
- Metricas: tempo medio de scrape, taxa de sucesso

**Endpoints usados:**
- `GET /api/admin/scraper-sessions`
- `DELETE /api/admin/scraper-sessions/{key}`
- `DELETE /api/admin/scraper-sessions`
- `POST /api/admin/reseed-suppliers`

---

### 7. `/admin/tenants` - Gestao de Tenants (Super Admin)
**O que mostrar:**
- Tabela com: nome, slug, plano, status, data criacao, num usuarios
- Acoes: criar, editar, deletar
- Criar usuario admin para o tenant
- Detalhe do tenant com metricas (usuarios, produtos, buscas)

**Endpoints usados:**
- `GET /api/tenants`
- `POST /api/tenants`
- `PATCH /api/tenants/{id}`
- `DELETE /api/tenants/{id}`
- `POST /api/tenants/{id}/users`

---

### 8. `/admin/settings` - Configuracoes
**O que mostrar:**
- Info do tenant atual (nome, slug, logo)
- Configuracoes de scraping (intervalo, max workers)
- Chaves de API (Groq, GitHub)
- Configuracoes de cache (TTL)
- Info do sistema (versao, uptime)

**Endpoints usados:**
- `GET /api/tenant/me`
- `GET /health`

---

### 9. `/admin/analytics` - Relatorios (futuro)
**O que mostrar:**
- Historico de precos por produto
- Comparativo entre fornecedores
- Produtos mais buscados
- Economia gerada (menor preco vs media)
- Exportar relatorios em CSV/PDF

**Observacao:** Precisa de novos endpoints para analytics.

---

## Estrutura de Navegacao

```
Admin Dashboard
├── Overview (/)
├── Usuarios (/users)
├── Produtos (/products)
├── Fornecedores (/suppliers)
├── Feedbacks (/feedback)
├── Scrapers (/scrapers)
├── Tenants (/tenants)        ← so super_admin
├── Analytics (/analytics)
└── Configuracoes (/settings)
```

## Roles e Permissoes no Dashboard

| Pagina | super_admin | admin | gerente | funcionario |
|--------|:-----------:|:-----:|:-------:|:-----------:|
| Overview | ✅ | ✅ | ✅ | ❌ |
| Usuarios | ✅ | ✅ | ❌ | ❌ |
| Produtos | ✅ | ✅ | ✅ | ❌ |
| Fornecedores | ✅ | ✅ | ❌ | ❌ |
| Feedbacks | ✅ | ✅ | ❌ | ❌ |
| Scrapers | ✅ | ✅ | ❌ | ❌ |
| Tenants | ✅ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ✅ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ |

## Componentes Compartilhados Necessarios

1. **AdminLayout** - Sidebar + header + breadcrumbs
2. **DataTable** - Tabela reutilizavel com sort, filter, pagination
3. **StatsCard** - Card de metrica com icone e variacao
4. **StatusBadge** - Badge colorido por status
5. **ConfirmDialog** - Modal de confirmacao para acoes destrutivas
6. **FormModal** - Modal de criacao/edicao reutilizavel
7. **KanbanBoard** - Board para pipeline de feedbacks
8. **SearchInput** - Input de busca com debounce
9. **RoleGuard** - Componente de protecao por role
10. **Toast** - Notificacoes de sucesso/erro
