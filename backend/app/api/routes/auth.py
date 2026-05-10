import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import TenantDB, UserDB
from app.models.user import LoginRequest, LoginResponse
from app.utils.auth import create_token, verify_password
from app.utils.tenant import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserDB).where(
            UserDB.email == request.email,
            UserDB.tenant_id == tenant.id,
            UserDB.is_active == True,
        )
    )
    user = result.scalars().first()

    if not user or not verify_password(request.password, user.password_hash):
        return LoginResponse(success=False, message="Email ou senha inválidos")

    token = create_token({
        "sub": str(user.id),
        "email": user.email,
        "tenant_id": tenant.id,
        "tenant_slug": tenant.slug,
        "role": user.role.value,
    })

    logger.info("Login: %s [tenant=%s]", request.email, tenant.slug)

    return LoginResponse(
        success=True,
        message="Login realizado com sucesso",
        user={"email": user.email, "name": user.nome, "role": user.role.value},
        token=token,
    )


@router.post("/super-admin/login")
async def super_admin_login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login exclusivo para super admins (sem tenant)."""
    from app.models.db_models import UserRole
    result = await db.execute(
        select(UserDB).where(
            UserDB.email == request.email,
            UserDB.role == UserRole.SUPER_ADMIN,
            UserDB.tenant_id == None,
            UserDB.is_active == True,
        )
    )
    user = result.scalars().first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_token({
        "sub": str(user.id),
        "email": user.email,
        "tenant_id": None,
        "tenant_slug": None,
        "role": user.role.value,
    })

    logger.info("Super admin login: %s", request.email)
    return {"token": token, "user": {"email": user.email, "name": user.nome, "role": user.role.value}}
