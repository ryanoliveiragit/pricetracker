import logging
import traceback
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import SavedOfferDB, TenantDB
from app.models.saved_offer import SavedOfferCreate, SavedOfferResponse
from app.utils.auth import get_current_user_email
from app.utils.tenant import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=List[SavedOfferResponse])
async def list_saved_offers(
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    try:
        result = await db.execute(
            select(SavedOfferDB)
            .where(
                SavedOfferDB.user_email == user_email,
                SavedOfferDB.tenant_id == tenant.id,
            )
            .order_by(SavedOfferDB.created_at.desc())
        )
        return result.scalars().all()
    except Exception as e:
        logger.error("Erro ao listar ofertas: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=SavedOfferResponse)
async def save_offer(
    data: SavedOfferCreate,
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    try:
        existing = await db.execute(
            select(SavedOfferDB).where(
                SavedOfferDB.user_email == user_email,
                SavedOfferDB.tenant_id == tenant.id,
                SavedOfferDB.product_url == data.product_url,
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Esta oferta já está salva.")

        db_obj = SavedOfferDB(
            tenant_id=tenant.id,
            user_email=user_email,
            store=data.store,
            product_name=data.product_name,
            price=data.price,
            currency=data.currency,
            product_url=data.product_url,
            image_url=data.image_url,
            availability=data.availability,
            sku=data.sku,
            brand=data.brand,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro ao salvar oferta: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{save_id}")
async def delete_saved_offer(
    save_id: int,
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(get_current_user_email),
    tenant: TenantDB = Depends(get_current_tenant),
):
    try:
        result = await db.execute(
            delete(SavedOfferDB).where(
                SavedOfferDB.id == save_id,
                SavedOfferDB.user_email == user_email,
                SavedOfferDB.tenant_id == tenant.id,
            )
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Oferta não encontrada.")
        return {"status": "success", "message": "Oferta removida."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro ao deletar oferta: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
