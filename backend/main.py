import logging
from contextlib import asynccontextmanager

from app.api.routes import agent, auth, products, saves, search, suppliers, users
from app.config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configurar logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup / shutdown events."""
    from app.database import create_tables
    from app.services.catalog_scraper import run_catalog_scrape
    from app.services.seed import seed_defaults
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    await create_tables()
    await seed_defaults()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_catalog_scrape,
        "interval",
        hours=2,
        id="catalog_scrape",
        name="Pre-scrape catalog products",
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info("🚀 ConstruPrice API pronta (scheduler ativo — scraping a cada 2h)")

    # Auto-trigger: se catálogo vazio, dispara primeiro scraping
    import asyncio

    from app.database import async_session
    from app.models.db_models import ScrapedProductDB
    from sqlalchemy import func, select

    async with async_session() as session:
        count = await session.execute(
            select(func.count()).select_from(ScrapedProductDB)
        )
        if (count.scalar() or 0) == 0:
            logger.info(
                "📦 Catálogo vazio — disparando primeiro scraping automaticamente"
            )
            asyncio.create_task(run_catalog_scrape())

    yield

    scheduler.shutdown(wait=False)
    logger.info("👋 ConstruPrice API encerrando")


# Criar aplicação FastAPI
app = FastAPI(
    title="ConstruPrice API",
    description="API de comparação de preços de materiais de construção com web scraping",
    version="1.0.0",
    lifespan=lifespan,
)

# Configurar CORS
# Auth uses JWT via Authorization header (not cookies), so allow_credentials=False
# is safe and required when allow_origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rotas
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(suppliers.router, prefix="/api", tags=["suppliers"])
app.include_router(products.router, prefix="/api", tags=["products"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(saves.router, prefix="/api/saves", tags=["saves"])
app.include_router(agent.router, prefix="/api", tags=["agent"])


@app.get("/api/admin/scraper-sessions")
async def list_scraper_sessions():
    """Lista todas as sessões de scraper persistidas no banco."""
    from app.services.session_persistence import list_sessions
    import asyncio
    sessions = await asyncio.to_thread(list_sessions)
    return {"sessions": sessions, "total": len(sessions)}


@app.delete("/api/admin/scraper-sessions/{scraper_key}")
async def delete_scraper_session(scraper_key: str):
    """Remove sessão persistida e força novo login na próxima busca."""
    from app.services.session_persistence import delete_session
    from app.services.session_cache import invalidate
    import asyncio
    deleted = await asyncio.to_thread(delete_session, scraper_key)
    invalidate(scraper_key)
    return {"deleted": deleted, "scraper_key": scraper_key}


@app.delete("/api/admin/scraper-sessions")
async def clear_all_scraper_sessions():
    """Remove todas as sessões persistidas. Todos os scrapers farão login na próxima busca."""
    from app.services.session_persistence import list_sessions, delete_session
    from app.services.session_cache import invalidate
    import asyncio
    sessions = await asyncio.to_thread(list_sessions)
    for s in sessions:
        await asyncio.to_thread(delete_session, s["scraper_key"])
        invalidate(s["scraper_key"])
    return {"deleted": len(sessions)}


@app.post("/api/admin/reseed-suppliers")
async def reseed_suppliers():
    """Force recreate all suppliers with default credentials. Use when DB has wrong/empty creds."""
    from app.services.seed import force_reseed_suppliers

    count = await force_reseed_suppliers()
    return {"status": "ok", "suppliers_recreated": count}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "message": "ConstruPrice API - Sistema de Comparação de Preços",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
