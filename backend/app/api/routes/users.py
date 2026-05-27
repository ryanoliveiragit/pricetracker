import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import TenantDB, UserDB, UserRole
from app.models.user import UserCreate, UserUpdate, UserResponse
from app.utils.auth import get_current_user_email, get_password_hash
from app.utils.tenant import get_current_tenant
from app.services.email_service import send_credentials_email

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_dict(u: UserDB) -> dict:
    return {
        "id": u.id,
        "nome": u.nome or "",
        "email": u.email,
        "telefone": u.telefone or "",
        "empresa": u.empresa or "",
        "cargo": u.cargo or "",
        "avatar": u.avatar or "",
        "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        "is_active": u.is_active,
        "parent_id": u.parent_id,
        "tenant_id": u.tenant_id,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


async def _get_tenant_user(db: AsyncSession, email: str, tenant_id: str) -> UserDB:
    result = await db.execute(
        select(UserDB).filter(UserDB.email == email, UserDB.tenant_id == tenant_id)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return user


# ── ME ─────────────────────────────────────────────────────────────────────────

@router.get("/users/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    user = await _get_tenant_user(db, email, tenant.id)
    return _to_dict(user)


@router.patch("/users/me")
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    user = await _get_tenant_user(db, email, tenant.id)

    if data.nome is not None:
        user.nome = data.nome
    if data.telefone is not None:
        user.telefone = data.telefone
    if data.empresa is not None:
        user.empresa = data.empresa
    if data.cargo is not None:
        user.cargo = data.cargo
    if data.avatar is not None:
        user.avatar = data.avatar
    if data.password:
        user.password_hash = get_password_hash(data.password)

    await db.commit()
    await db.refresh(user)
    return _to_dict(user)


# ── LIST ──────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list)
async def list_users(
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    result = await db.execute(
        select(UserDB)
        .where(UserDB.tenant_id == tenant.id)
        .order_by(UserDB.created_at.desc())
    )
    return [_to_dict(u) for u in result.scalars().all()]


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("/users", status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    existing = await db.execute(
        select(UserDB).filter(UserDB.email == data.email, UserDB.tenant_id == tenant.id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    try:
        role_enum = UserRole(data.role or "funcionario")
    except ValueError:
        role_enum = UserRole.FUNCIONARIO

    user = UserDB(
        tenant_id=tenant.id,
        nome=data.nome,
        email=data.email,
        telefone=data.telefone or "",
        empresa=data.empresa or "",
        cargo=data.cargo or "",
        avatar=data.avatar or "",
        password_hash=get_password_hash(data.password),
        role=role_enum,
        parent_id=data.parent_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Usuário criado: %s [%s] tenant=%s", user.email, user.role, tenant.slug)

    app_name = (tenant.settings or {}).get("app_name") or tenant.name or "PriceTracker"
    base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
    login_url = f"{base_url}/{tenant.slug}/login"
    await send_credentials_email(
        to_email=user.email,
        nome=user.nome or user.email,
        password=data.password,
        login_url=login_url,
        app_name=app_name,
    )

    return _to_dict(user)


# ── GET BY ID ─────────────────────────────────────────────────────────────────

@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    result = await db.execute(
        select(UserDB).where(UserDB.id == user_id, UserDB.tenant_id == tenant.id)
    )
    u = result.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return _to_dict(u)


# ── UPDATE ────────────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    result = await db.execute(
        select(UserDB).where(UserDB.id == user_id, UserDB.tenant_id == tenant.id)
    )
    u = result.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if data.nome is not None:
        u.nome = data.nome
    if data.telefone is not None:
        u.telefone = data.telefone
    if data.empresa is not None:
        u.empresa = data.empresa
    if data.cargo is not None:
        u.cargo = data.cargo
    if data.avatar is not None:
        u.avatar = data.avatar
    if data.is_active is not None:
        u.is_active = data.is_active
    if data.role is not None:
        try:
            u.role = UserRole(data.role)
        except ValueError:
            pass
    if data.password:
        u.password_hash = get_password_hash(data.password)

    await db.commit()
    await db.refresh(u)
    return _to_dict(u)


# ── DELETE ────────────────────────────────────────────────────────────────────

@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    result = await db.execute(
        select(UserDB).where(UserDB.id == user_id, UserDB.tenant_id == tenant.id)
    )
    u = result.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    await db.delete(u)
    await db.commit()


# ── TOGGLE STATUS ─────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    result = await db.execute(
        select(UserDB).where(UserDB.id == user_id, UserDB.tenant_id == tenant.id)
    )
    u = result.scalars().first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    u.is_active = not u.is_active
    await db.commit()
    await db.refresh(u)
    return _to_dict(u)
