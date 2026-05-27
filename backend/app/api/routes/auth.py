import logging
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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


@router.post("/refresh")
async def refresh_token(authorization: Optional[str] = Header(default=None)):
    """Renova o token JWT. Aceita tokens expirados há até 7 dias."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = authorization[7:] if authorization.startswith("Bearer ") else authorization
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

    # Só renova se expirou há menos de 7 dias
    exp = payload.get("exp", 0)
    now = int(datetime.now(timezone.utc).timestamp())
    if exp and (now - exp) > 7 * 24 * 3600:
        raise HTTPException(status_code=401, detail="Sessão encerrada — faça login novamente")

    new_token = create_token({k: v for k, v in payload.items() if k != "exp"})
    return {"access_token": new_token, "token_type": "bearer"}


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
