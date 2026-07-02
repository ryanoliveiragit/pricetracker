# ConstruPrice PriceTracker

O **ConstruPrice PriceTracker** é o monorepo full‑stack da plataforma ConstruPrice, focado em coleta automatizada de preços de fornecedores de materiais de construção via scraping paralelo e exposição desses dados em APIs e interfaces web.  
Este projeto demonstra experiência prática em arquitetura de sistemas, integração de múltiplos serviços, deploy contínuo e uso de IA para acelerar desenvolvimento.

## O que este projeto mostra sobre minha experiência

- Capacidade de desenhar e manter um **monorepo** com backend, API, frontend, web institucional e documentação técnica organizada.
- Uso de **Python + FastAPI** para scrapers resilientes e APIs de dados, com **TypeScript** no frontend/admin.
- Integração com Docker, Render, Vercel e automação de deploy (mais de 180 deployments registrados no GitHub).
- Documentação completa da codebase, endpoints e fluxos de scraping, facilitando onboarding de outros devs.

## Tecnologias e stack

Principais tecnologias utilizadas neste monorepo:

- **TypeScript (≈ 59%)** – frontend, web e tooling.
- **Python (≈ 36%)** – backend, FastAPI, scrapers, orquestração.
- **CSS** – estilização da camada web/admin.
- **Docker Compose** – ambiente local com múltiplos serviços.
- **Render** – deploy de backend/API, com configuração em `render.yaml`.
- **Vercel** – deploy de frontend/web, com configuração em `vercel.json`.
- **Playwright** – base para testes end‑to‑end (pasta `.playwright-mcp`).
- **Integração com AI (Claude)** – fluxo de desenvolvimento assistido documentado em `.claude` e `CLAUDE.md`.

## Arquitetura em alto nível

Este repositório concentra os principais módulos do sistema:

```text
.
├── api/          # API pública (FastAPI) e integrações
├── backend/      # Core de negócio, scraping, serviços internos
├── frontend/     # Dashboard/admin em TypeScript
├── web/          # Site institucional / landing page (lpconstructprice.vercel.app)
├── scopo/        # Módulo adicional do monorepo
├── .claude/      # Configuração/artefatos de assistente de IA
├── .playwright-mcp/ # Configuração de testes automatizados
├── main.py       # Main FastAPI com arquitetura em 3 camadas resilientes
├── docker-compose.yml # Orquestração de serviços em dev
├── render.yaml   # Deploy backend/API na Render
├── vercel.json   # Deploy frontend/web na Vercel
└── *.md          # Guias e documentação técnica
```

O `main.py` é descrito nos commits como um **main resiliente em 3 camadas** para FastAPI, lidando melhor com erros, presets e runtime.

## Principais funcionalidades de produto

Do ponto de vista de negócio, o projeto entrega:

- Scraping paralelo de múltiplos fornecedores, reduzindo tempo de coleta de preços.
- APIs para consulta, filtragem e exportação de preços e dados de catálogo.
- Dashboard administrativo para visualização, operações de importação/exportação e gestão de informações.
- Site institucional e landing page em `lpconstructprice.vercel.app` integrados ao backend.
- Scripts de bootstrap (`start-all.bat`, `docker-compose.yml`) para subir todo o ambiente rapidamente.

## Documentação técnica existente

Para facilitar manutenção e onboarding, o repositório inclui:

- `INICIO_RAPIDO.md` – visão geral e bootstrap rápido.
- `SETUP_BACKEND.md` – configuração detalhada do backend e serviços.
- `API_ENDPOINTS.md` – lista de endpoints e contratos da API.
- `SCRAPER_GUIDE.md` – guia dos scrapers por fornecedor (fluxos, campos, limites).
- `GUIA_WEB_SCRAPING.md` – abordagem de scraping e boas práticas.
- `ADMIN_DASHBOARD_GUIDE.md` – UX e operações do painel administrativo.
- `CODEBASE_MAPPING.md` – mapeamento da codebase, módulos e responsabilidades.
- `LANDING_CONTENT.md` – conteúdo de marketing para a landing.
- `CLAUDE.md` – uso de assistente de IA no ciclo de desenvolvimento.

## Execução em ambiente de desenvolvimento

### Pré‑requisitos

- Python (alinhado em `.python-version`, atualmente 3.12).
- Docker e Docker Compose.
- Node.js + gerenciador de pacotes (npm/pnpm) para o frontend.

### Passos básicos

```bash
git clone https://github.com/ryanoliveiragit/pricetracker.git
cd pricetracker

cp .env.example .env
# Preencher variáveis de ambiente (credenciais, URLs, chaves de API etc.)
```

Subir o stack completo em dev:

```bash
docker compose up --build
```

Rodar backend/API manualmente:

```bash
pip install -r requirements.txt
python main.py
```

Usuários Windows podem usar:

```bash
start-all.bat
```

## Deploy e operação

O projeto possui histórico de mais de 180 deploys registrados na aba de Deployments do GitHub, incluindo ambientes de produção.

- Backend/API configurados via `render.yaml` para a Render.
- Frontend/web configurados via `vercel.json` para Vercel, incluindo `lpconstructprice.vercel.app`.

## Sobre o autor

Sou **Ryan Oliveira (@ryanoliveiragit)**, desenvolvedor full‑stack baseado em São Paulo, focado em:

- Frontend moderno (React/Next.js, TypeScript) e experiências web voltadas a produto.
- Backend com Python, APIs e automação (scraping, pipelines de dados).
- Criação de plataformas para nichos específicos, como o mercado de construção e gaming.

Este monorepo é um exemplo real de como estruturo um projeto complexo, indo de ideia a produção, com documentação, testes, deploy e evolução contínua.
