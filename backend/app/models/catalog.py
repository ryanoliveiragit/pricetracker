from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CatalogProduct(BaseModel):
    """Modelo de produto do catálogo"""
    id: str
    name: str
    category: str
    brand: str
    unit: str
    logo: Optional[str] = ""
    notes: Optional[str] = ""
    variants: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class CatalogProductCreate(BaseModel):
    """Dados para criar produto"""
    name: str
    category: str
    brand: str
    unit: str
    sku: Optional[str] = ""
    logo: Optional[str] = ""
    notes: Optional[str] = ""
    variants: List[str] = []


class CatalogProductUpdate(BaseModel):
    """Dados para atualizar produto (todos opcionais)"""
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    unit: Optional[str] = None
    sku: Optional[str] = None
    logo: Optional[str] = None
    notes: Optional[str] = None
    variants: Optional[List[str]] = None
