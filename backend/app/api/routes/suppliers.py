from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid
import logging

from app.models.supplier import SupplierCreate, SupplierUpdate
from app.models.db_models import SupplierDB
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_camel_dict(s: SupplierDB) -> dict:
    """Converte modelo DB para camelCase para compatibilidade com frontend."""
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
        "createdAt": s.created_at.isoformat() if s.created_at else "",
    }


def _to_pydantic(s: SupplierDB):
    """Convert DB model to Pydantic-like object for search.py compatibility."""
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


async def get_all_suppliers_from_db() -> list:
    """Helper used by search.py to get suppliers list."""
    from app.database import async_session
    async with async_session() as session:
        result = await session.execute(select(SupplierDB))
        return [_to_pydantic(s) for s in result.scalars().all()]


@router.get("/suppliers")
async def list_suppliers(db: AsyncSession = Depends(get_db)):
    """Listar todos os fornecedores."""
    result = await db.execute(select(SupplierDB).order_by(SupplierDB.created_at.desc()))
    return [_to_camel_dict(s) for s in result.scalars().all()]


@router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, db: AsyncSession = Depends(get_db)):
    """Buscar fornecedor por ID."""
    s = await db.get(SupplierDB, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return _to_camel_dict(s)


@router.post("/suppliers", status_code=201)
async def create_supplier(data: SupplierCreate, db: AsyncSession = Depends(get_db)):
    """Criar novo fornecedor."""
    supplier = SupplierDB(
        id=str(uuid.uuid4()),
        name=data.name,
        url=data.url,
        logo=data.logo or "",
        requires_login=data.requires_login,
        username=data.username or "",
        password=data.password or "",
        is_active=data.is_active,
        region=data.region or "",
        notes=data.notes or "",
        created_at=datetime.now(timezone.utc),
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    logger.info(f"Fornecedor criado: {supplier.name}")
    return _to_camel_dict(supplier)


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, data: SupplierUpdate, db: AsyncSession = Depends(get_db)):
    """Atualizar fornecedor parcialmente."""
    s = await db.get(SupplierDB, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(s, key, value)

    await db.commit()
    await db.refresh(s)
    logger.info(f"Fornecedor atualizado: {s.name}")
    return _to_camel_dict(s)


@router.delete("/suppliers/{supplier_id}", status_code=204)
async def delete_supplier(supplier_id: str, db: AsyncSession = Depends(get_db)):
    """Remover fornecedor."""
    s = await db.get(SupplierDB, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    await db.delete(s)
    await db.commit()
    logger.info(f"Fornecedor removido: {s.name}")
