import asyncio
import inspect
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import SupplierDB, TenantDB, UserDB
from app.models.supplier import SupplierCreate, SupplierUpdate
from app.utils.auth import get_current_user_email, get_token_payload
from app.utils.tenant import get_current_tenant, get_optional_tenant

logger = logging.getLogger(__name__)
router = APIRouter()

_SCRAPER_MAP = None


def _get_scraper_map() -> dict:
    global _SCRAPER_MAP
    if _SCRAPER_MAP is None:
        from app.scrapers.cofema_scraper import CofemaScraper
        from app.scrapers.estoque_atacadista_scraper import EstoqueAtacadistaScraper
        from app.scrapers.megaleste_scraper import MegalesteScraper
        from app.scrapers.superabc_scraper import SuperABCScraper
        _SCRAPER_MAP = {
            "megaleste":   (MegalesteScraper,         "megaleste"),
            "cofema":      (CofemaScraper,             "cofema"),
            "atacadista":  (EstoqueAtacadistaScraper,  "estoqueAtacadista"),
            "super abc":   (SuperABCScraper,           "superabc"),
            "superabc":    (SuperABCScraper,           "superabc"),
        }
    return _SCRAPER_MAP


def _resolve_scraper(name: str) -> Tuple[Optional[type], Optional[str]]:
    name_lower = name.lower().strip()
    for keyword, (cls, key) in _get_scraper_map().items():
        if keyword in name_lower:
            return cls, key
    return None, None


def _do_login(scraper_class, username: str, password: str, region: str) -> Tuple[bool, Optional[str], object]:
    scraper = scraper_class()
    try:
        sig = inspect.signature(scraper.login)
        if "region" in sig.parameters:
            success = scraper.login(username, password, region=region)
        else:
            success = scraper.login(username, password)
    except Exception as e:
        return False, str(e), None

    login_error = getattr(scraper, "login_error", None)
    session = getattr(scraper, "session", None)
    is_logged_in = getattr(scraper, "is_logged_in", success)

    if success and is_logged_in:
        return True, None, session
    return False, login_error or "Login falhou — verifique usuário e senha", None


async def _test_and_save_login(
    supplier_name: str, username: str, password: str, region: str,
) -> Tuple[bool, Optional[str]]:
    scraper_class, scraper_key = _resolve_scraper(supplier_name)
    if not scraper_class:
        return False, f"Nenhum scraper configurado para '{supplier_name}'"

    logger.info("🔐 Testando login para '%s' (chave: %s)", supplier_name, scraper_key)
    try:
        loop = asyncio.get_event_loop()
        success, error_msg, session = await asyncio.wait_for(
            loop.run_in_executor(None, _do_login, scraper_class, username, password, region or "sp"),
            timeout=35.0,
        )
    except asyncio.TimeoutError:
        return False, "Timeout ao tentar conectar — verifique se o site está acessível"
    except Exception as e:
        return False, f"Erro inesperado ao testar login: {e}"

    if success and session is not None:
        from app.services.session_cache import store_session
        store_session(scraper_key, username, session)
        return True, None

    return False, error_msg


def _to_camel_dict(s: SupplierDB, creator_name: str = None) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "url": s.url or "",
        "logo": s.logo or "",
        "requiresLogin": s.requires_login,
        "username": s.username or "",
        "password": s.password or "",
        "isActive": s.is_active,
        "region": s.region or "",
        "notes": s.notes or "",
        "createdBy": creator_name or "",
        "createdAt": s.created_at.isoformat() if s.created_at else "",
    }


def _to_pydantic(s: SupplierDB):
    from app.models.supplier import Supplier
    return Supplier(
        id=s.id,
        name=s.name,
        url=s.url or "",
        logo=s.logo or "",
        requires_login=s.requires_login,
        username=s.username or "",
        password=s.password or "",
        is_active=s.is_active,
        region=s.region or "",
        notes=s.notes or "",
        created_at=s.created_at.isoformat() if s.created_at else "",
    )


async def get_all_suppliers_from_db(tenant_id: Optional[str] = None) -> list:
    """Used by search route. Pass tenant_id to scope results."""
    from app.database import async_session
    async with async_session() as session:
        query = select(SupplierDB)
        if tenant_id:
            query = query.where(SupplierDB.tenant_id == tenant_id)
        result = await session.execute(query)
        return [_to_pydantic(s) for s in result.scalars().all()]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/suppliers/scrapers")
async def list_tenant_scrapers(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Returns only suppliers that have a mapped scraper for the authenticated tenant."""
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant não identificado no token")

    result = await db.execute(
        select(SupplierDB)
        .where(SupplierDB.tenant_id == tenant_id)
        .order_by(SupplierDB.name)
    )
    suppliers = result.scalars().all()

    logger.info("Scrapers lookup: tenant_id=%s total_suppliers=%d", tenant_id, len(suppliers))

    scrapers = []
    for s in suppliers:
        _, scraper_key = _resolve_scraper(s.name)
        logger.info("  supplier='%s' is_active=%s scraper_key=%s", s.name, s.is_active, scraper_key)
        if scraper_key:
            scrapers.append({
                "id": s.id,
                "name": s.name,
                "scraperKey": scraper_key,
                "isActive": s.is_active,
                "requiresLogin": s.requires_login,
                "region": s.region or "",
                "logo": s.logo or "",
            })

    return scrapers


@router.get("/suppliers/me")
async def list_my_suppliers(
    payload: dict = Depends(get_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Returns suppliers linked to the authenticated user's tenant (uses JWT tenant_id)."""
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant não identificado no token")

    result = await db.execute(
        select(SupplierDB)
        .where(SupplierDB.tenant_id == tenant_id)
        .order_by(SupplierDB.created_at.desc())
    )
    suppliers = result.scalars().all()

    creator_ids = {s.created_by for s in suppliers if s.created_by}
    creator_names: dict = {}
    if creator_ids:
        users_result = await db.execute(select(UserDB).filter(UserDB.id.in_(creator_ids)))
        for u in users_result.scalars().all():
            creator_names[u.id] = u.nome or u.email

    return [_to_camel_dict(s, creator_names.get(s.created_by)) for s in suppliers]


@router.get("/suppliers")
async def list_suppliers(
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupplierDB)
        .where(SupplierDB.tenant_id == tenant.id)
        .order_by(SupplierDB.created_at.desc())
    )
    suppliers = result.scalars().all()

    creator_ids = {s.created_by for s in suppliers if s.created_by}
    creator_names = {}
    if creator_ids:
        users_result = await db.execute(select(UserDB).filter(UserDB.id.in_(creator_ids)))
        for u in users_result.scalars().all():
            creator_names[u.id] = u.nome or u.email

    return [_to_camel_dict(s, creator_names.get(s.created_by)) for s in suppliers]


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupplierDB).where(SupplierDB.id == supplier_id, SupplierDB.tenant_id == tenant.id)
    )
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return _to_camel_dict(s)


@router.post("/suppliers", status_code=201)
async def create_supplier(
    data: SupplierCreate,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
):
    user_result = await db.execute(
        select(UserDB).filter(UserDB.email == email, UserDB.tenant_id == tenant.id)
    )
    current_user = user_result.scalars().first()
    creator_id = current_user.id if current_user else None

    if data.requires_login and data.username and data.password:
        ok, error_msg = await _test_and_save_login(
            data.name, data.username, data.password, data.region or "sp"
        )
        if not ok:
            raise HTTPException(
                status_code=422,
                detail={"login_error": True, "message": error_msg or "Login falhou — verifique as credenciais"},
            )

    supplier = SupplierDB(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        name=data.name,
        url=data.url,
        logo=data.logo or "",
        requires_login=data.requires_login,
        username=data.username or "",
        password=data.password or "",
        is_active=data.is_active,
        region=data.region or "",
        notes=data.notes or "",
        created_by=creator_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    logger.info("Fornecedor criado: %s [tenant=%s]", supplier.name, tenant.slug)
    return _to_camel_dict(supplier, current_user.nome if current_user else "")


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    tenant: Optional[TenantDB] = Depends(get_optional_tenant),
    db: AsyncSession = Depends(get_db),
):
    query = select(SupplierDB).where(SupplierDB.id == supplier_id)
    if tenant:
        query = query.where(SupplierDB.tenant_id == tenant.id)
    result = await db.execute(query)
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    new_username = update_data.get("username", s.username)
    new_password = update_data.get("password", s.password)
    new_region = update_data.get("region", s.region) or "sp"
    new_name = update_data.get("name", s.name)
    new_requires_login = update_data.get("requires_login", s.requires_login)
    credentials_changed = "username" in update_data or "password" in update_data

    if new_requires_login and new_username and new_password and credentials_changed:
        ok, error_msg = await _test_and_save_login(new_name, new_username, new_password, new_region)
        if not ok:
            raise HTTPException(
                status_code=422,
                detail={"login_error": True, "message": error_msg or "Login falhou — verifique as credenciais"},
            )

    for key, value in update_data.items():
        setattr(s, key, value)

    await db.commit()
    await db.refresh(s)
    return _to_camel_dict(s)


class TestLoginBody(BaseModel):
    username: str
    password: str


@router.post("/suppliers/{supplier_id}/test-login")
async def test_supplier_login(
    supplier_id: str,
    body: TestLoginBody,
    tenant: Optional[TenantDB] = Depends(get_optional_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Testa login do scraper com as credenciais fornecidas no body."""
    # Busca globalmente por ID — não filtra por tenant, pois o admin gerencia fornecedores de todos os tenants
    result = await db.execute(select(SupplierDB).where(SupplierDB.id == supplier_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    scraper_class, _ = _resolve_scraper(s.name)
    if not scraper_class:
        return {"ok": False, "message": f"Nenhum scraper mapeado para '{s.name}'"}

    ok, error_msg = await _test_and_save_login(s.name, body.username, body.password, s.region or "sp")
    if ok:
        return {"ok": True, "message": "Login realizado com sucesso"}
    return {"ok": False, "message": error_msg or "Login falhou"}


@router.delete("/suppliers/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: str,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupplierDB).where(SupplierDB.id == supplier_id, SupplierDB.tenant_id == tenant.id)
    )
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    await db.delete(s)
    await db.commit()
