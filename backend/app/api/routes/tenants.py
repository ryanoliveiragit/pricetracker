"""
Tenant management routes.

GET  /api/tenant/me        — public: current tenant info (for frontend branding)
GET  /api/tenants          — super admin: list all tenants
POST /api/tenants          — super admin: create tenant
PATCH /api/tenants/{id}    — super admin: update tenant
DELETE /api/tenants/{id}   — super admin: delete tenant
POST /api/tenants/{id}/users — super admin: create first admin user for a tenant
"""
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import TenantDB, UserDB, UserRole, SupplierDB, ProductDB, SearchCacheDB, SavedOfferDB
from app.utils.auth import create_token, get_password_hash, get_token_payload
from app.utils.tenant import get_current_tenant
from app.services.email_service import send_credentials_email

logger = logging.getLogger(__name__)
router = APIRouter()


def _tenant_login_url(slug: str) -> str:
    """Returns the login URL for a tenant using subdomain-based routing."""
    base_domain = os.getenv("APP_BASE_DOMAIN", "localhost:3000")
    protocol = "http" if "localhost" in base_domain else "https"
    return f"{protocol}://{slug}.{base_domain}/login"


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

import re as _re

_SLUG_RE = _re.compile(r"^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$")
_SLUG_RESERVED = {"www", "admin", "api", "app", "mail", "demo", "staging", "dev", "test"}


class TenantSignupRequest(BaseModel):
    # Empresa
    company_name: str
    slug: str
    plan: str = "free"
    # Admin
    admin_nome: str
    admin_email: str
    admin_password: str
    # Branding
    app_name: str = ""
    primary_color: str = "#2563eb"
    accent_color: str = "#7c3aed"
    logo_url: str = ""


class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: str = "free"
    settings: dict = {}


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None
    owner_user_id: Optional[str] = None


class TenantAdminCreate(BaseModel):
    nome: str
    email: str
    password: str


def _tenant_dict(
    t: TenantDB,
    user_count: int = 0,
    supplier_count: int = 0,
    product_count: int = 0,
    searches30d: int = 0,
) -> dict:
    settings = t.settings or {}
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "plan": t.plan,
        "settings": settings,
        "active": t.is_active,
        "owner_user_id": settings.get("owner_user_id"),
        "users": user_count,
        "suppliers": supplier_count,
        "products": product_count,
        "searches30d": searches30d,
        "app_name": settings.get("app_name", ""),
        "color": settings.get("primary_color", settings.get("color", "")),
        "created": t.created_at.isoformat() if t.created_at else "",
    }


# ─── Super admin guard ────────────────────────────────────────────────────────

async def require_super_admin(
    payload: dict = Depends(get_token_payload),
) -> dict:
    if payload.get("role") != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a super admins")
    return payload


# ─── Public ───────────────────────────────────────────────────────────────────

@router.get("/tenants/check-slug")
async def check_slug_availability(slug: str, db: AsyncSession = Depends(get_db)):
    """Public — checks if a slug is valid and available."""
    slug = slug.lower().strip()
    if not _SLUG_RE.match(slug):
        return {"available": False, "reason": "Use apenas letras minúsculas, números e hífens (mín. 4 caracteres)"}
    if slug in _SLUG_RESERVED:
        return {"available": False, "reason": f"'{slug}' é reservado"}
    existing = await db.execute(select(TenantDB).where(TenantDB.slug == slug))
    if existing.scalars().first():
        return {"available": False, "reason": f"'{slug}' já está em uso"}
    return {"available": True, "reason": None}


@router.post("/tenants/signup", status_code=201)
async def signup_tenant(data: TenantSignupRequest, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint — creates a new tenant + first admin user in one step.
    Returns a JWT so the user is immediately logged in.
    """
    slug = data.slug.lower().strip()

    # Validate slug
    if not _SLUG_RE.match(slug):
        raise HTTPException(status_code=422, detail="Slug inválido. Use letras minúsculas, números e hífens (mín. 4 chars).")
    if slug in _SLUG_RESERVED:
        raise HTTPException(status_code=422, detail=f"O subdomínio '{slug}' é reservado.")

    existing_slug = await db.execute(select(TenantDB).where(TenantDB.slug == slug))
    if existing_slug.scalars().first():
        raise HTTPException(status_code=400, detail=f"O subdomínio '{slug}' já está em uso.")

    # Validate password
    if len(data.admin_password) < 6:
        raise HTTPException(status_code=422, detail="A senha deve ter pelo menos 6 caracteres.")

    # Create tenant
    tenant = TenantDB(
        id=str(uuid.uuid4()),
        name=data.company_name,
        slug=slug,
        plan=data.plan,
        settings={
            "app_name": data.app_name or data.company_name,
            "primary_color": data.primary_color,
            "accent_color": data.accent_color,
            "logo_url": data.logo_url,
        },
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tenant)
    await db.flush()  # get tenant.id without committing yet

    # Create first admin user
    admin = UserDB(
        tenant_id=tenant.id,
        nome=data.admin_nome,
        email=data.admin_email,
        password_hash=get_password_hash(data.admin_password),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(admin)

    token = create_token({
        "sub": str(admin.id),
        "email": admin.email,
        "tenant_id": tenant.id,
        "tenant_slug": tenant.slug,
        "role": admin.role.value,
    })

    logger.info("Signup: tenant=%s admin=%s", slug, data.admin_email)

    return {
        "token": token,
        "tenant": _tenant_dict(tenant),
        "user": {"id": admin.id, "nome": admin.nome, "email": admin.email, "role": admin.role.value},
        "loginUrl": f"/{slug}",
    }


@router.get("/tenant/me")
async def get_current_tenant_info(
    tenant: TenantDB = Depends(get_current_tenant),
):
    """Returns branding/settings for the current tenant — used by frontend on load."""
    return _tenant_dict(tenant)


# ─── Super admin CRUD ─────────────────────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    from datetime import datetime, timezone, timedelta

    result = await db.execute(select(TenantDB).order_by(TenantDB.created_at.desc()))
    tenants = result.scalars().all()

    user_counts_result = await db.execute(
        select(UserDB.tenant_id, func.count(UserDB.id)).group_by(UserDB.tenant_id)
    )
    user_counts = {row[0]: row[1] for row in user_counts_result.all()}

    supplier_counts_result = await db.execute(
        select(SupplierDB.tenant_id, func.count(SupplierDB.id)).group_by(SupplierDB.tenant_id)
    )
    supplier_counts = {row[0]: row[1] for row in supplier_counts_result.all()}

    product_counts_result = await db.execute(
        select(ProductDB.tenant_id, func.count(ProductDB.id)).group_by(ProductDB.tenant_id)
    )
    product_counts = {row[0]: row[1] for row in product_counts_result.all()}

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    search_counts_result = await db.execute(
        select(SearchCacheDB.tenant_id, func.count(SearchCacheDB.id))
        .where(SearchCacheDB.created_at >= cutoff)
        .group_by(SearchCacheDB.tenant_id)
    )
    search_counts = {row[0]: row[1] for row in search_counts_result.all()}

    return [
        _tenant_dict(
            t,
            user_count=user_counts.get(t.id, 0),
            supplier_count=supplier_counts.get(t.id, 0),
            product_count=product_counts.get(t.id, 0),
            searches30d=search_counts.get(t.id, 0),
        )
        for t in tenants
    ]


@router.post("/tenants", status_code=201)
async def create_tenant(
    data: TenantCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    # Check slug uniqueness
    existing = await db.execute(select(TenantDB).where(TenantDB.slug == data.slug))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"Slug '{data.slug}' já está em uso")

    tenant = TenantDB(
        id=str(uuid.uuid4()),
        name=data.name,
        slug=data.slug,
        plan=data.plan,
        settings=data.settings,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    logger.info("Tenant criado: %s (%s)", tenant.name, tenant.slug)
    return _tenant_dict(tenant)


@router.patch("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    data: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    if data.name is not None:
        tenant.name = data.name
    if data.plan is not None:
        tenant.plan = data.plan
    if data.settings is not None:
        tenant.settings = data.settings
    if data.is_active is not None:
        tenant.is_active = data.is_active
    if data.owner_user_id is not None:
        current_settings = dict(tenant.settings or {})
        current_settings["owner_user_id"] = data.owner_user_id
        tenant.settings = current_settings

    await db.commit()
    await db.refresh(tenant)
    return _tenant_dict(tenant)


@router.delete("/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    # Remove filhos em ordem para evitar violação de FK
    for model in (SavedOfferDB, SearchCacheDB, ProductDB, SupplierDB, UserDB):
        await db.execute(delete(model).where(model.tenant_id == tenant_id))

    await db.delete(tenant)
    await db.commit()
    logger.info("Tenant removido: %s", tenant_id)


@router.post("/tenants/{tenant_id}/users", status_code=201)
async def create_tenant_admin(
    tenant_id: str,
    data: TenantAdminCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """Creates the first admin user for a tenant."""
    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    existing = await db.execute(
        select(UserDB).where(UserDB.email == data.email, UserDB.tenant_id == tenant_id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado neste tenant")

    user = UserDB(
        tenant_id=tenant_id,
        nome=data.nome,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Admin criado: %s [tenant=%s]", user.email, tenant.slug)

    app_name = (tenant.settings or {}).get("app_name") or tenant.name or "PriceTracker"
    await send_credentials_email(
        to_email=user.email,
        nome=user.nome or user.email,
        password=data.password,
        login_url=_tenant_login_url(tenant.slug),
        app_name=app_name,
    )

    return {"id": user.id, "email": user.email, "nome": user.nome, "role": user.role.value}


# ─── Super admin user management ─────────────────────────────────────────────

class AdminUserPasswordReset(BaseModel):
    new_password: str


@router.post("/admin/users/{user_id}/resend-credentials", status_code=200)
async def admin_resend_user_credentials(
    user_id: int,
    data: AdminUserPasswordReset,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """Super admin: reset user password and resend credentials email. No tenant header required."""
    user = await db.get(UserDB, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user.password_hash = get_password_hash(data.new_password)
    await db.commit()

    if user.tenant_id:
        tenant = await db.get(TenantDB, user.tenant_id)
        if tenant:
            app_name = (tenant.settings or {}).get("app_name") or tenant.name or "PriceTracker"
            await send_credentials_email(
                to_email=user.email,
                nome=user.nome or user.email,
                password=data.new_password,
                login_url=_tenant_login_url(tenant.slug),
                app_name=app_name,
            )

    logger.info("Credenciais reenviadas para user=%s pelo super admin", user.email)
    return {"id": user.id, "email": user.email}


# ─── Tenant activity sparkline ────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/activity")
async def get_tenant_activity(
    tenant_id: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """Returns daily search counts for the last N days — used for sparkline charts."""
    from datetime import datetime, timezone, timedelta

    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(SearchCacheDB.created_at).label("day"),
            func.count(SearchCacheDB.id).label("count"),
        )
        .where(SearchCacheDB.tenant_id == tenant_id, SearchCacheDB.created_at >= cutoff)
        .group_by(func.date(SearchCacheDB.created_at))
        .order_by(func.date(SearchCacheDB.created_at))
    )
    rows = {str(row.day): row.count for row in result.all()}

    # Build a complete series with 0 for days without searches
    series = []
    for i in range(days):
        day = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        series.append(rows.get(day, 0))

    return {"tenant_id": tenant_id, "days": days, "series": series}


# ─── Tenant ↔ Suppliers management (super admin) ─────────────────────────────

class TenantSuppliersAssign(BaseModel):
    supplier_ids: list[str]


class SupplierLinkCredentials(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    region: Optional[str] = None
    test_login: bool = False


class TenantSupplierWithCredentials(BaseModel):
    id: str
    username: Optional[str] = None
    password: Optional[str] = None
    region: Optional[str] = None
    test_login: bool = False


class TenantSuppliersAssignWithCredentials(BaseModel):
    suppliers: list[TenantSupplierWithCredentials]


@router.get("/tenants/{tenant_id}/suppliers")
async def list_tenant_suppliers(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """List all suppliers assigned to a tenant."""
    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    result = await db.execute(
        select(SupplierDB).where(SupplierDB.tenant_id == tenant_id)
    )
    suppliers = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "logo": s.logo,
            "requiresLogin": s.requires_login,
            "username": s.username or "",
            "password": s.password or "",
            "isActive": s.is_active,
            "region": s.region,
        }
        for s in suppliers
    ]


@router.put("/tenants/{tenant_id}/suppliers")
async def assign_suppliers_to_tenant(
    tenant_id: str,
    data: TenantSuppliersAssignWithCredentials,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """Assign suppliers to a tenant with optional credentials per supplier (replaces current assignments)."""
    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    current = await db.execute(
        select(SupplierDB).where(SupplierDB.tenant_id == tenant_id)
    )
    for s in current.scalars().all():
        s.tenant_id = None

    assigned = []
    login_errors = []
    for item in data.suppliers:
        supplier = await db.get(SupplierDB, item.id)
        if not supplier:
            continue

        if item.username is not None:
            supplier.username = item.username
        if item.password is not None:
            supplier.password = item.password
        if item.region is not None:
            supplier.region = item.region

        if item.test_login and supplier.requires_login and supplier.username and supplier.password:
            from app.api.routes.suppliers import _test_and_save_login
            ok, error_msg = await _test_and_save_login(
                supplier.name, supplier.username, supplier.password, supplier.region or "sp"
            )
            if not ok:
                login_errors.append({"supplier": supplier.name, "error": error_msg})
                continue

        supplier.tenant_id = tenant_id
        assigned.append(supplier.name)

    await db.commit()
    logger.info("Suppliers atribuídos ao tenant %s: %s", tenant.slug, assigned)
    return {"assigned": len(assigned), "suppliers": assigned, "loginErrors": login_errors}


@router.post("/tenants/{tenant_id}/suppliers/{supplier_id}")
async def add_supplier_to_tenant(
    tenant_id: str,
    supplier_id: str,
    body: SupplierLinkCredentials = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """Add a single supplier to a tenant, optionally setting credentials."""
    from fastapi import Body
    tenant = await db.get(TenantDB, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    supplier = await db.get(SupplierDB, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    if body:
        if body.username is not None:
            supplier.username = body.username
        if body.password is not None:
            supplier.password = body.password
        if body.region is not None:
            supplier.region = body.region

        if body.test_login and supplier.requires_login and supplier.username and supplier.password:
            from app.api.routes.suppliers import _test_and_save_login
            ok, error_msg = await _test_and_save_login(
                supplier.name, supplier.username, supplier.password, supplier.region or "sp"
            )
            if not ok:
                raise HTTPException(
                    status_code=422,
                    detail={"login_error": True, "message": error_msg or "Login falhou — verifique as credenciais"},
                )

    supplier.tenant_id = tenant_id
    await db.commit()
    logger.info("Supplier %s → tenant %s", supplier.name, tenant.slug)
    return {
        "message": f"Fornecedor '{supplier.name}' vinculado ao tenant '{tenant.name}'",
        "hasCredentials": bool(supplier.username and supplier.password),
    }


@router.delete("/tenants/{tenant_id}/suppliers/{supplier_id}", status_code=204)
async def remove_supplier_from_tenant(
    tenant_id: str,
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """Remove a supplier from a tenant (unassigns, doesn't delete)."""
    supplier = await db.get(SupplierDB, supplier_id)
    if not supplier or supplier.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado neste tenant")

    supplier.tenant_id = None
    await db.commit()
    logger.info("Supplier %s removido do tenant %s", supplier.name, tenant_id)


@router.get("/suppliers/unassigned")
async def list_unassigned_suppliers(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_super_admin),
):
    """List all suppliers not assigned to any tenant."""
    result = await db.execute(
        select(SupplierDB).where(SupplierDB.tenant_id == None)
    )
    suppliers = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "logo": s.logo,
            "requiresLogin": s.requires_login,
            "isActive": s.is_active,
            "region": s.region,
        }
        for s in suppliers
    ]
