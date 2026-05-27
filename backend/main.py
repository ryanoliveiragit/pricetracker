import sys as _sys
import os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))

from dotenv import load_dotenv as _load_dotenv
_backend_dir = _os.path.dirname(_os.path.abspath(__file__))
_root_dir = _os.path.join(_backend_dir, "..")
_env_mode = _os.environ.get("APP_ENV", "development")
# Load environment-specific file first (higher priority), then base .env as fallback
if _env_mode == "production":
    _load_dotenv(_os.path.join(_backend_dir, ".env.production"))
    _load_dotenv(_os.path.join(_root_dir, ".env.production"))
_load_dotenv(_os.path.join(_backend_dir, ".env"))
_load_dotenv(_os.path.join(_root_dir, ".env"))

import logging
import os
from contextlib import asynccontextmanager

from app.api.routes import agent, auth, feedback, products, saves, search, suppliers, tenants, users
from app.config import settings
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

_CORS_ORIGINS_RE = (
    r"https://pricetracker[^.]*\.vercel\.app"
    r"|https?://[a-z0-9-]+\.pricetracker\.(com|com\.br|app)(:\d+)?"
    r"|http://[a-z0-9-]+\.localhost(:\d+)?"
)


# Configurar logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup / shutdown events."""
    _is_vercel = os.environ.get("VERCEL")

    try:
        from app.database import create_tables
        await create_tables()
    except Exception as _e:
        logger.error(f"DB create_tables failed (continuing): {_e}")

    try:
        from app.services.seed import seed_defaults
        await seed_defaults()
    except Exception as _e:
        logger.error(f"seed_defaults failed (continuing): {_e}")

    try:
        from app.database import async_session as _session
        from app.models.db_models import DynamicAbbreviationDB, DynamicSynonymDB
        from app.services.synonyms import load_dynamic_abbreviations, load_dynamic_synonyms
        from sqlalchemy import select as _select
        async with _session() as _db:
            _abbrev_rows = await _db.execute(_select(DynamicAbbreviationDB))
            _pairs = [(r.long_form, r.short_forms) for r in _abbrev_rows.scalars().all()]
            load_dynamic_abbreviations(_pairs)

            _syn_rows = await _db.execute(_select(DynamicSynonymDB))
            _groups = [r.group for r in _syn_rows.scalars().all()]
            load_dynamic_synonyms(_groups)

            if _pairs or _groups:
                logger.info(f"📚 {len(_pairs)} abreviações e {len(_groups)} grupos de sinônimos dinâmicos carregados")
    except Exception as _e:
        logger.error(f"Dynamic data load failed (continuing): {_e}")

    scheduler = None
    if not _is_vercel:
        try:
            import asyncio
            from app.database import async_session
            from app.models.db_models import ScrapedProductDB
            from app.services.catalog_scraper import run_catalog_scrape
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from sqlalchemy import func, select

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

            async with async_session() as session:
                count = await session.execute(
                    select(func.count()).select_from(ScrapedProductDB)
                )
                if (count.scalar() or 0) == 0:
                    logger.info("📦 Catálogo vazio — disparando primeiro scraping automaticamente")
                    asyncio.create_task(run_catalog_scrape())
        except Exception as _e:
            logger.error(f"Scheduler setup failed (continuing): {_e}")
    else:
        logger.info("🚀 ConstruPrice API pronta (Vercel — scheduler desabilitado)")

    yield

    if scheduler:
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
_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        *_extra_origins,
    ],
    allow_origin_regex=_CORS_ORIGINS_RE,
    allow_credentials=True,
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
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(tenants.router, prefix="/api", tags=["tenants"])

# Serve uploaded screenshots statically
try:
    from fastapi.staticfiles import StaticFiles
    import os as _os
    _upload_dir = "/tmp/uploads" if _os.environ.get("VERCEL") else "uploads"
    _os.makedirs(f"{_upload_dir}/feedback", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=_upload_dir), name="uploads")
except Exception as _static_err:
    logger.warning(f"StaticFiles mount skipped: {_static_err}")


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


# ─── Super Admin endpoints (cross-tenant) ────────────────────────────────────

from app.utils.auth import get_token_payload
from app.models.db_models import UserRole


async def _require_super_admin(payload: dict = Depends(get_token_payload)) -> dict:
    if payload.get("role") != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Acesso restrito a super admins")
    return payload


@app.get("/api/admin/users")
async def admin_list_users(
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import UserDB, TenantDB
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(
            select(UserDB).order_by(UserDB.created_at.desc())
        )
        users = result.scalars().all()

        # Get tenant names
        tenant_result = await db.execute(select(TenantDB))
        tenants = {t.id: t for t in tenant_result.scalars().all()}

        return [
            {
                "id": str(u.id),
                "name": u.nome or "",
                "email": u.email,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
                "tenant_id": u.tenant_id,
                "tenant_name": tenants[u.tenant_id].name if u.tenant_id and u.tenant_id in tenants else "",
                "active": u.is_active,
                "last_login": None,
            }
            for u in users
        ]


@app.get("/api/admin/catalog")
async def admin_list_catalog(
    store: str = None,
    q: str = None,
    limit: int = 100,
    offset: int = 0,
    _: dict = Depends(_require_super_admin),
):
    """Super admin: catálogo global de produtos scraped (ScrapedProductDB).
    Filtros opcionais: store, q (busca por nome), limit, offset."""
    from app.database import async_session
    from app.models.db_models import ScrapedProductDB
    from sqlalchemy import select, func

    async with async_session() as db:
        query = select(ScrapedProductDB).order_by(ScrapedProductDB.scraped_at.desc())

        if store:
            query = query.where(ScrapedProductDB.store == store)
        if q:
            query = query.where(ScrapedProductDB.product_name_normalized.ilike(f"%{q.lower()}%"))

        total_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = total_result.scalar() or 0

        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        products = result.scalars().all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [
                {
                    "id": p.id,
                    "store": p.store,
                    "name": p.product_name,
                    "price": p.price,
                    "currency": p.currency,
                    "availability": p.availability,
                    "sku": p.sku or "",
                    "brand": p.brand or "",
                    "image_url": p.image_url or "",
                    "product_url": p.product_url,
                    "source_query": p.source_query,
                    "scraper_key": p.scraper_key,
                    "scraped_at": p.scraped_at.isoformat() if p.scraped_at else "",
                }
                for p in products
            ],
        }


@app.get("/api/admin/suppliers")
async def admin_list_suppliers(
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import SupplierDB
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(
            select(SupplierDB).order_by(SupplierDB.created_at.desc())
        )
        suppliers = result.scalars().all()
        return [
            {
                "id": str(s.id),
                "name": s.name,
                "slug": s.url or "",
                "login_type": "credenciais" if s.requires_login else "público",
                "active": s.is_active if hasattr(s, "is_active") else True,
                "region": s.region if hasattr(s, "region") else "",
                "created_at": s.created_at.isoformat() if s.created_at else "",
            }
            for s in suppliers
        ]


@app.post("/api/admin/suppliers", status_code=201)
async def admin_create_supplier(
    data: dict,
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import SupplierDB
    from datetime import datetime, timezone
    import uuid

    async with async_session() as db:
        supplier = SupplierDB(
            id=str(uuid.uuid4()),
            tenant_id=None,
            name=data.get("name", ""),
            url=data.get("url", ""),
            logo=data.get("logo", ""),
            requires_login=data.get("requiresLogin", False),
            username=data.get("username", ""),
            password=data.get("password", ""),
            is_active=data.get("isActive", True),
            region=data.get("region", ""),
            notes=data.get("notes", ""),
            created_at=datetime.now(timezone.utc),
        )
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)
        return {
            "id": str(supplier.id),
            "name": supplier.name,
            "url": supplier.url or "",
            "logo": supplier.logo or "",
            "requiresLogin": supplier.requires_login,
            "username": supplier.username or "",
            "password": supplier.password or "",
            "isActive": supplier.is_active,
            "region": supplier.region or "",
            "notes": supplier.notes or "",
            "created_at": supplier.created_at.isoformat() if supplier.created_at else "",
        }


@app.patch("/api/admin/suppliers/{supplier_id}")
async def admin_update_supplier(
    supplier_id: str,
    data: dict,
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import SupplierDB

    async with async_session() as db:
        supplier = await db.get(SupplierDB, supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

        field_map = {
            "name": "name", "url": "url", "logo": "logo",
            "requiresLogin": "requires_login", "username": "username",
            "password": "password", "isActive": "is_active",
            "region": "region", "notes": "notes",
        }
        for json_key, db_field in field_map.items():
            if json_key in data:
                setattr(supplier, db_field, data[json_key])

        await db.commit()
        await db.refresh(supplier)
        return {
            "id": str(supplier.id),
            "name": supplier.name,
            "url": supplier.url or "",
            "logo": supplier.logo or "",
            "requiresLogin": supplier.requires_login,
            "username": supplier.username or "",
            "password": supplier.password or "",
            "isActive": supplier.is_active,
            "region": supplier.region or "",
            "notes": supplier.notes or "",
            "created_at": supplier.created_at.isoformat() if supplier.created_at else "",
        }


@app.delete("/api/admin/suppliers/{supplier_id}", status_code=204)
async def admin_delete_supplier(
    supplier_id: str,
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import SupplierDB

    async with async_session() as db:
        supplier = await db.get(SupplierDB, supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
        await db.delete(supplier)
        await db.commit()


@app.get("/api/admin/feedback")
async def admin_list_feedback(
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import FeedbackReportDB
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(
            select(FeedbackReportDB).order_by(FeedbackReportDB.created_at.desc())
        )
        reports = result.scalars().all()
        return [
            {
                "id": str(r.id),
                "title": r.ai_summary or r.description or f"Feedback #{r.id}",
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "priority": (
                    "critical" if (r.ai_confidence or 0) >= 0.9 else
                    "high" if (r.ai_confidence or 0) >= 0.7 else
                    "medium" if (r.ai_confidence or 0) >= 0.4 else
                    "low"
                ),
                "problem_type": r.problem_type or "",
                "search_query": r.search_query or "",
                "description": r.description or "",
                "ai_fix_type": r.ai_fix_type or "",
                "ai_confidence": r.ai_confidence or 0,
                "created_at": r.created_at.isoformat() if r.created_at else "",
                "user_email": r.user_email if hasattr(r, "user_email") else "",
            }
            for r in reports
        ]


_PLAN_PRICES = {"free": 0, "pro": 149, "enterprise": 499}


def _mrr_from_tenants(tenants) -> float:
    return sum(_PLAN_PRICES.get((t.plan or "free").lower(), 0) for t in tenants)


@app.get("/api/admin/stats")
async def admin_stats(
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import FeedbackReportDB, SearchCacheDB, SupplierDB, TenantDB, UserDB
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, select

    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)
    cutoff_60 = now - timedelta(days=60)

    async with async_session() as db:
        tenants_total = (await db.execute(select(func.count()).select_from(TenantDB))).scalar() or 0
        tenants_active = (await db.execute(
            select(func.count()).select_from(TenantDB).where(TenantDB.is_active == True)
        )).scalar() or 0
        users_total = (await db.execute(select(func.count()).select_from(UserDB))).scalar() or 0
        users_active = (await db.execute(
            select(func.count()).select_from(UserDB).where(UserDB.is_active == True)
        )).scalar() or 0
        suppliers_total = (await db.execute(select(func.count()).select_from(SupplierDB))).scalar() or 0
        feedback_total = (await db.execute(select(func.count()).select_from(FeedbackReportDB))).scalar() or 0
        feedback_pending = (await db.execute(
            select(func.count()).select_from(FeedbackReportDB).where(FeedbackReportDB.status == "pending")
        )).scalar() or 0

        # Searches last 30d vs previous 30d
        searches_30d = (await db.execute(
            select(func.count()).select_from(SearchCacheDB).where(SearchCacheDB.created_at >= cutoff_30)
        )).scalar() or 0
        searches_prev = (await db.execute(
            select(func.count()).select_from(SearchCacheDB).where(
                SearchCacheDB.created_at >= cutoff_60, SearchCacheDB.created_at < cutoff_30
            )
        )).scalar() or 0

        # New tenants last 30d vs previous 30d
        tenants_30d = (await db.execute(
            select(func.count()).select_from(TenantDB).where(TenantDB.created_at >= cutoff_30)
        )).scalar() or 0
        tenants_prev_30d = (await db.execute(
            select(func.count()).select_from(TenantDB).where(
                TenantDB.created_at >= cutoff_60, TenantDB.created_at < cutoff_30
            )
        )).scalar() or 0

        # New users last 30d vs previous 30d
        users_30d = (await db.execute(
            select(func.count()).select_from(UserDB).where(UserDB.created_at >= cutoff_30)
        )).scalar() or 0
        users_prev_30d = (await db.execute(
            select(func.count()).select_from(UserDB).where(
                UserDB.created_at >= cutoff_60, UserDB.created_at < cutoff_30
            )
        )).scalar() or 0

        # MRR: current active tenants × plan price
        all_active_tenants = (await db.execute(
            select(TenantDB).where(TenantDB.is_active == True)
        )).scalars().all()
        mrr = _mrr_from_tenants(all_active_tenants)

        # MRR previous period: remove tenants created in last 30d
        prev_tenants = [t for t in all_active_tenants if t.created_at and t.created_at < cutoff_30]
        mrr_prev = _mrr_from_tenants(prev_tenants)

        def _delta(current, previous) -> float:
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round((current - previous) / previous * 100, 1)

        return {
            "tenants_total": tenants_total,
            "tenants_active": tenants_active,
            "users_total": users_total,
            "users_active": users_active,
            "suppliers_total": suppliers_total,
            "feedback_total": feedback_total,
            "feedback_pending": feedback_pending,
            # KPI card extras
            "searches_30d": searches_30d,
            "mrr": mrr,
            "searches_delta_pct": _delta(searches_30d, searches_prev),
            "mrr_delta_pct": _delta(mrr, mrr_prev),
            "tenants_delta_pct": _delta(tenants_30d, tenants_prev_30d),
            "users_delta_pct": _delta(users_30d, users_prev_30d),
        }


@app.get("/api/admin/stats/series")
async def admin_stats_series(
    days: int = 30,
    _: dict = Depends(_require_super_admin),
):
    """Daily time-series for sparkline charts: new tenants, active users, searches, cumulative MRR."""
    from app.database import async_session
    from app.models.db_models import SearchCacheDB, TenantDB, UserDB
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, select

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    async with async_session() as db:
        # Daily new tenants
        t_rows = await db.execute(
            select(func.date(TenantDB.created_at).label("day"), func.count(TenantDB.id).label("cnt"))
            .where(TenantDB.created_at >= cutoff)
            .group_by(func.date(TenantDB.created_at))
            .order_by(func.date(TenantDB.created_at))
        )
        tenants_by_day = {str(r.day): r.cnt for r in t_rows.all()}

        # Daily new users
        u_rows = await db.execute(
            select(func.date(UserDB.created_at).label("day"), func.count(UserDB.id).label("cnt"))
            .where(UserDB.created_at >= cutoff)
            .group_by(func.date(UserDB.created_at))
            .order_by(func.date(UserDB.created_at))
        )
        users_by_day = {str(r.day): r.cnt for r in u_rows.all()}

        # Daily searches
        s_rows = await db.execute(
            select(func.date(SearchCacheDB.created_at).label("day"), func.count(SearchCacheDB.id).label("cnt"))
            .where(SearchCacheDB.created_at >= cutoff)
            .group_by(func.date(SearchCacheDB.created_at))
            .order_by(func.date(SearchCacheDB.created_at))
        )
        searches_by_day = {str(r.day): r.cnt for r in s_rows.all()}

        # All tenants for cumulative MRR
        all_tenants = (await db.execute(select(TenantDB))).scalars().all()

    # Build daily series (fill gaps with 0)
    tenants_series, users_series, searches_series, revenue_series = [], [], [], []
    cumulative_mrr = 0.0

    # Tenants created before window already contribute to MRR baseline
    window_start_date = cutoff.date()
    for t in all_tenants:
        t_date = t.created_at.date() if t.created_at else None
        if t_date and t_date < window_start_date and t.is_active:
            cumulative_mrr += _PLAN_PRICES.get((t.plan or "free").lower(), 0)

    for i in range(days):
        day = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        new_t = tenants_by_day.get(day, 0)
        tenants_series.append(new_t)
        users_series.append(users_by_day.get(day, 0))
        searches_series.append(searches_by_day.get(day, 0))

        # Accumulate MRR for tenants created on this day
        for t in all_tenants:
            if t.created_at and t.created_at.strftime("%Y-%m-%d") == day and t.is_active:
                cumulative_mrr += _PLAN_PRICES.get((t.plan or "free").lower(), 0)
        revenue_series.append(round(cumulative_mrr))

    return {
        "tenants": tenants_series,
        "active_users": users_series,
        "searches": searches_series,
        "revenue": revenue_series,
    }


@app.get("/api/admin/stats/plan-distribution")
async def admin_stats_plan_distribution(
    _: dict = Depends(_require_super_admin),
):
    """Count of active tenants per plan — used for the donut chart."""
    from app.database import async_session
    from app.models.db_models import TenantDB
    from sqlalchemy import func, select

    async with async_session() as db:
        rows = await db.execute(
            select(TenantDB.plan, func.count(TenantDB.id).label("cnt"))
            .where(TenantDB.is_active == True)
            .group_by(TenantDB.plan)
        )
        counts = {(r.plan or "free").lower(): r.cnt for r in rows.all()}

    return {
        "free": counts.get("free", 0),
        "pro": counts.get("pro", 0),
        "enterprise": counts.get("enterprise", 0),
    }


@app.get("/api/admin/stats/searches-daily")
async def admin_stats_searches_daily(
    days: int = 14,
    _: dict = Depends(_require_super_admin),
):
    """Daily search counts with formatted labels — used for the bar chart."""
    from app.database import async_session
    from app.models.db_models import SearchCacheDB
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, select

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    async with async_session() as db:
        rows = await db.execute(
            select(func.date(SearchCacheDB.created_at).label("day"), func.count(SearchCacheDB.id).label("cnt"))
            .where(SearchCacheDB.created_at >= cutoff)
            .group_by(func.date(SearchCacheDB.created_at))
            .order_by(func.date(SearchCacheDB.created_at))
        )
        by_day = {str(r.day): r.cnt for r in rows.all()}

    labels, values = [], []
    for i in range(days):
        dt = now - timedelta(days=days - 1 - i)
        day_key = dt.strftime("%Y-%m-%d")
        labels.append(dt.strftime("%d/%m"))
        values.append(by_day.get(day_key, 0))

    return {"labels": labels, "values": values}


@app.get("/api/admin/events")
async def admin_events(
    limit: int = 10,
    _: dict = Depends(_require_super_admin),
):
    """Recent system events feed derived from DB activity."""
    from app.database import async_session
    from app.models.db_models import CatalogScrapeStatusDB, FeedbackReportDB, TenantDB, UserDB
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select

    async with async_session() as db:
        events = []

        # New tenants (last 30 days)
        t_rows = (await db.execute(
            select(TenantDB).where(
                TenantDB.created_at >= datetime.now(timezone.utc) - timedelta(days=30)
            ).order_by(TenantDB.created_at.desc()).limit(limit)
        )).scalars().all()
        for t in t_rows:
            events.append({
                "type": "ok",
                "message": f"Novo tenant criado: {t.name} ({t.plan})",
                "timestamp": t.created_at.isoformat(),
            })

        # Recent feedback reports
        f_rows = (await db.execute(
            select(FeedbackReportDB).order_by(FeedbackReportDB.created_at.desc()).limit(limit)
        )).scalars().all()
        for f in f_rows:
            events.append({
                "type": "warn" if f.status.value == "pending" else "info",
                "message": f"Feedback #{f.id}: {(f.ai_summary or f.description or '')[:80]}",
                "timestamp": f.created_at.isoformat(),
            })

        # Scraper run results
        sc_rows = (await db.execute(
            select(CatalogScrapeStatusDB).order_by(CatalogScrapeStatusDB.started_at.desc()).limit(limit)
        )).scalars().all()
        for sc in sc_rows:
            ts = (sc.finished_at or sc.started_at).isoformat()
            if sc.status == "done":
                events.append({
                    "type": "ok",
                    "message": f"Scraper {sc.scraper_key} concluído — {sc.total_products} produtos",
                    "timestamp": ts,
                })
            elif sc.status == "error":
                events.append({
                    "type": "err",
                    "message": f"Scraper {sc.scraper_key} falhou: {(sc.error_message or '')[:80]}",
                    "timestamp": ts,
                })
            else:
                events.append({
                    "type": "info",
                    "message": f"Scraper {sc.scraper_key}: {sc.status}",
                    "timestamp": ts,
                })

        # New users
        u_rows = (await db.execute(
            select(UserDB).where(
                UserDB.created_at >= datetime.now(timezone.utc) - timedelta(days=30)
            ).order_by(UserDB.created_at.desc()).limit(limit)
        )).scalars().all()
        for u in u_rows:
            events.append({
                "type": "info",
                "message": f"Novo usuário: {u.email} ({u.role.value if hasattr(u.role, 'value') else u.role})",
                "timestamp": u.created_at.isoformat(),
            })

    # Sort all events by timestamp desc, return top N
    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:limit]


@app.get("/api/admin/suppliers/{supplier_id}/scraper-config")
async def admin_get_scraper_config(
    supplier_id: str,
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import ScraperConfigDB
    from sqlalchemy import select
    async with async_session() as db:
        result = await db.execute(select(ScraperConfigDB).where(ScraperConfigDB.supplier_id == supplier_id))
        cfg = result.scalars().first()
        if not cfg:
            return None
        return {
            "supplierId": cfg.supplier_id,
            "searchUrl": cfg.search_url or "",
            "baseUrl": cfg.base_url or "",
            "containerSelector": cfg.container_selector or "",
            "nameSelector": cfg.name_selector or "",
            "priceSelector": cfg.price_selector or "",
            "linkSelector": cfg.link_selector or "a",
            "imageSelector": cfg.image_selector or "",
            "skuSelector": cfg.sku_selector or "",
            "loginUrl": cfg.login_url or "",
            "loginUsernameField": cfg.login_username_field or "email",
            "loginPasswordField": cfg.login_password_field or "password",
            "loginCsrfSelector": cfg.login_csrf_selector or "",
            "loginSubmitUrl": cfg.login_submit_url or "",
            "loginSuccessCheck": cfg.login_success_check or "url",
            "loginSuccessValue": cfg.login_success_value or "login",
        }


@app.put("/api/admin/suppliers/{supplier_id}/scraper-config")
async def admin_upsert_scraper_config(
    supplier_id: str,
    data: dict,
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import ScraperConfigDB, SupplierDB
    from sqlalchemy import select
    from datetime import datetime, timezone

    async with async_session() as db:
        supplier = await db.get(SupplierDB, supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

        result = await db.execute(select(ScraperConfigDB).where(ScraperConfigDB.supplier_id == supplier_id))
        cfg = result.scalars().first()

        fields = {
            "search_url": data.get("searchUrl", ""),
            "base_url": data.get("baseUrl", ""),
            "container_selector": data.get("containerSelector", ""),
            "name_selector": data.get("nameSelector", ""),
            "price_selector": data.get("priceSelector", ""),
            "link_selector": data.get("linkSelector", "a"),
            "image_selector": data.get("imageSelector", ""),
            "sku_selector": data.get("skuSelector", ""),
            "login_url": data.get("loginUrl", ""),
            "login_username_field": data.get("loginUsernameField", "email"),
            "login_password_field": data.get("loginPasswordField", "password"),
            "login_csrf_selector": data.get("loginCsrfSelector", ""),
            "login_submit_url": data.get("loginSubmitUrl", ""),
            "login_success_check": data.get("loginSuccessCheck", "url"),
            "login_success_value": data.get("loginSuccessValue", "login"),
        }

        if cfg:
            for k, v in fields.items():
                setattr(cfg, k, v)
            cfg.updated_at = datetime.now(timezone.utc)
        else:
            cfg = ScraperConfigDB(supplier_id=supplier_id, **fields)
            db.add(cfg)

        await db.commit()
        return {"ok": True, "message": "Configuração salva"}


@app.post("/api/admin/suppliers/{supplier_id}/test-scraper")
async def admin_test_scraper(
    supplier_id: str,
    data: dict,
    _: dict = Depends(_require_super_admin),
):
    from app.database import async_session
    from app.models.db_models import ScraperConfigDB, SupplierDB
    from app.scrapers.dynamic_scraper import DynamicScraper
    from sqlalchemy import select
    import asyncio

    query = (data.get("query") or "cimento").strip()
    username = data.get("username", "")
    password = data.get("password", "")

    async with async_session() as db:
        supplier = await db.get(SupplierDB, supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
        result = await db.execute(select(ScraperConfigDB).where(ScraperConfigDB.supplier_id == supplier_id))
        cfg = result.scalars().first()

    if not cfg or not cfg.search_url:
        return {"ok": False, "error": "Scraper não configurado — preencha a URL de busca e os seletores primeiro"}

    config_dict = {
        "store_name": supplier.name,
        "supplier_id": supplier_id,
        "cache_key": f"dynamic_{supplier_id[:8]}",
        "base_url": cfg.base_url or "",
        "search_url": cfg.search_url,
        "container_selector": cfg.container_selector or "",
        "name_selector": cfg.name_selector or "",
        "price_selector": cfg.price_selector or "",
        "link_selector": cfg.link_selector or "a",
        "image_selector": cfg.image_selector or "",
        "sku_selector": cfg.sku_selector or "",
        "login_url": cfg.login_url or "",
        "login_username_field": cfg.login_username_field or "email",
        "login_password_field": cfg.login_password_field or "password",
        "login_csrf_selector": cfg.login_csrf_selector or "",
        "login_submit_url": cfg.login_submit_url or "",
        "login_success_check": cfg.login_success_check or "url",
        "login_success_value": cfg.login_success_value or "login",
        "requires_login": supplier.requires_login,
    }

    def _run():
        scraper = DynamicScraper(config_dict)
        return scraper.search(query, username=username, password=password)

    try:
        loop = asyncio.get_event_loop()
        offers = await asyncio.wait_for(loop.run_in_executor(None, _run), timeout=30.0)
        return {
            "ok": True,
            "total": len(offers),
            "sample": [
                {"product_name": o.product_name, "price": o.price, "product_url": o.product_url}
                for o in offers[:5]
            ],
        }
    except asyncio.TimeoutError:
        return {"ok": False, "error": "Timeout — o site não respondeu em 30s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


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
