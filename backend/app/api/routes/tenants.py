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
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import TenantDB, UserDB, UserRole
from app.utils.auth import create_token, get_password_hash, get_token_payload
from app.utils.tenant import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter()


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


class TenantAdminCreate(BaseModel):
    nome: str
    email: str
    password: str


def _tenant_dict(t: TenantDB, user_count: int = 0) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "plan": t.plan,
        "settings": t.settings or {},
        "isActive": t.is_active,
        "userCount": user_count,
        "createdAt": t.created_at.isoformat() if t.created_at else "",
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
    result = await db.execute(select(TenantDB).order_by(TenantDB.created_at.desc()))
    tenants = result.scalars().all()

    # Count users per tenant
    counts_result = await db.execute(
        select(UserDB.tenant_id, func.count(UserDB.id)).group_by(UserDB.tenant_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    return [_tenant_dict(t, counts.get(t.id, 0)) for t in tenants]


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
    return {"id": user.id, "email": user.email, "nome": user.nome, "role": user.role.value}
