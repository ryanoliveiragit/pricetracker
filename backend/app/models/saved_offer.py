from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SavedOfferCreate(BaseModel):
    store: str
    product_name: str
    price: float
    currency: str = "BRL"
    product_url: str
    image_url: Optional[str] = None
    availability: str = "em_estoque"
    sku: Optional[str] = None
    brand: Optional[str] = None

class SavedOfferResponse(BaseModel):
    id: int
    store: str
    product_name: str
    price: float
    currency: str
    product_url: str
    image_url: Optional[str]
    availability: str
    sku: Optional[str]
    brand: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
