# PriceTracker

Sistema de comparação de preços com web scraping em múltiplas lojas atacadistas.

## Stack
- **Backend**: Python/FastAPI, SQLAlchemy async, PostgreSQL, Redis, Selenium, BeautifulSoup4
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Zod
- **Infra**: Docker Compose

## Estrutura
```
backend/
  main.py                        # entrypoint FastAPI + APScheduler (scraping a cada 2h)
  app/
    api/routes/                  # search, auth, products, suppliers, users, saves, agent
    models/db_models.py          # todos os modelos SQLAlchemy
    scrapers/                    # EstoqueAtacadista, Megaleste, Cofema, SuperABC
    services/                    # scraper_manager, cache, credentials_manager, search_agent, catalog_scraper
    utils/                       # text_normalizer, fuzzy matching
    database.py / config.py

frontend/src/
  app/                           # rotas Next.js (protected): search, results, products, agent, saves, settings, suppliers
  components/
  services/api.ts                # chamadas à API
  context/                       # React contexts (SupplierContext, etc.)
  store/                         # Zustand stores
```

## Modelos principais
- `ProductDB`: id, name, category, brand, unit, sku, logo, variants
- `SupplierDB`: id, name, url, logo, requires_login, username, password, is_active, region
- `UserDB`: id, email, nome, password_hash, role (admin|gestor|usuario|funcionario)
- `SearchCacheDB`: scraper_key, query, results (JSON), TTL 30min

## API endpoints relevantes
```
POST /api/search                        # busca streaming em múltiplas lojas
POST /api/search/by-supplier            # busca em fornecedor específico
POST /api/auth/login                    # JWT
GET/POST /api/products                  # catálogo
GET/POST /api/suppliers                 # fornecedores
POST/GET /api/saves                     # ofertas salvas
POST /api/agent                         # agente IA
```

## Scrapers
Cada scraper herda interface comum com método `search(query, credentials?)`.
- **EstoqueAtacadista**, **Cofema**: requerem login (Selenium)
- **Megaleste**, **SuperABC**: scraping público
- `ScraperManager` orquestra concorrência (MAX_WORKERS=5)
- `SessionPersistence` mantém sessões Selenium em cache

## Como rodar
```bash
# Docker (recomendado)
docker-compose up -d

# Manual
cd backend && python main.py        # :8000
cd frontend && npm run dev          # :3000
npm run dev:all                     # ambos juntos
```

## Env vars críticas
`DATABASE_URL`, `REDIS_URL`, `CREDENTIALS_ENCRYPTION_KEY`, `SUPPLIER_*_USERNAME/PASSWORD`
