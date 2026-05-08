from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
import logging
import traceback

from app.database import get_db
from app.models.db_models import SavedOfferDB
from app.models.saved_offer import SavedOfferCreate, SavedOfferResponse
from app.utils.auth import get_current_user_email

logger = logging.getLogger(__name__)
router = APIRouter()

async def get_user_email(email: str = Depends(get_current_user_email)):
    """Extract email from auth token."""
    return email

@router.get("", response_model=List[SavedOfferResponse])
async def list_saved_offers(
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(get_user_email)
):
    """Lista as ofertas salvas do usuário atual."""
    try:
        result = await db.execute(
            select(SavedOfferDB)
            .where(SavedOfferDB.user_email == user_email)
            .order_by(SavedOfferDB.created_at.desc())
        )
        offers = result.scalars().all()
        return offers
    except Exception as e:
        logger.error(f"Erro ao listar ofertas: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=SavedOfferResponse)
async def save_offer(
    data: SavedOfferCreate,
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(get_user_email)
):
    """Salva uma nova oferta para o usuário."""
    try:
        # Evitar duplicata da mesma URL para o mesmo usuário
        existing = await db.execute(
            select(SavedOfferDB).where(
                SavedOfferDB.user_email == user_email,
                SavedOfferDB.product_url == data.product_url
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Esta oferta já está salva.")

        db_obj = SavedOfferDB(
            user_email=user_email,
            store=data.store,
            product_name=data.product_name,
            price=data.price,
            currency=data.currency,
            product_url=data.product_url,
            image_url=data.image_url,
            availability=data.availability,
            sku=data.sku,
            brand=data.brand
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar oferta: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{save_id}")
async def delete_saved_offer(
    save_id: int,
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(get_user_email)
):
    """Remove uma oferta salva."""
    try:
        result = await db.execute(
            delete(SavedOfferDB).where(
                SavedOfferDB.id == save_id,
                SavedOfferDB.user_email == user_email
            )
        )
        await db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Oferta não encontrada.")
        
        return {"status": "success", "message": "Oferta removida."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao deletar oferta: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
