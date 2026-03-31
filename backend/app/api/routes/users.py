from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import logging

from app.database import get_db
from app.models.db_models import UserDB, UserRole
from app.models.user import UserCreate, UserUpdate, UserResponse
from app.utils.auth import get_password_hash

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
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ── LIST ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list)
async def list_users(db: AsyncSession = Depends(get_db)):
    """
    Lista todos os usuários cadastrados no banco.
    Em produção, filtrar por role/hierarquia via token JWT.
    """
    result = await db.execute(select(UserDB).order_by(UserDB.created_at.desc()))
    return [_to_dict(u) for u in result.scalars().all()]


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("/users", status_code=201)
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Cria novo usuário/funcionário."""
    # Verificar duplicata
    existing = await db.execute(select(UserDB).filter(UserDB.email == data.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    # Mapear role string → enum
    try:
        role_enum = UserRole(data.role or "funcionario")
    except ValueError:
        role_enum = UserRole.FUNCIONARIO

    user = UserDB(
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
    logger.info(f"Usuário criado: {user.email} [{user.role}]")
    return _to_dict(user)


# ── GET BY ID ─────────────────────────────────────────────────────────────────

@router.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    u = await db.get(UserDB, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return _to_dict(u)


# ── UPDATE ────────────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    """Edita dados de um usuário."""
    u = await db.get(UserDB, user_id)
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
    logger.info(f"Usuário atualizado: {u.email}")
    return _to_dict(u)


# ── DELETE ────────────────────────────────────────────────────────────────────

@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Remove permanentemente um usuário."""
    u = await db.get(UserDB, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    await db.delete(u)
    await db.commit()
    logger.info(f"Usuário removido: {u.email}")


# ── TOGGLE STATUS ─────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: int, db: AsyncSession = Depends(get_db)):
    """Ativa ou suspende o acesso de um usuário."""
    u = await db.get(UserDB, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    u.is_active = not u.is_active
    await db.commit()
    await db.refresh(u)
    return _to_dict(u)
