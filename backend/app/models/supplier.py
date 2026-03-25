from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SupplierCreate(BaseModel):
    """Dados para criar fornecedor"""
    name: str
    url: str
    logo: Optional[str] = ""
    requires_login: bool = Field(default=False, alias="requiresLogin")
    username: Optional[str] = ""
    password: Optional[str] = ""
    is_active: bool = Field(default=True, alias="isActive")
    region: Optional[str] = ""
    notes: Optional[str] = ""

    class Config:
        populate_by_name = True


class SupplierUpdate(BaseModel):
    """Dados para atualizar fornecedor (todos opcionais)"""
    name: Optional[str] = None
    url: Optional[str] = None
    logo: Optional[str] = None
    requires_login: Optional[bool] = Field(default=None, alias="requiresLogin")
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = Field(default=None, alias="isActive")
    region: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        populate_by_name = True


class Supplier(BaseModel):
    """Modelo de fornecedor"""
    id: str
    name: str
    url: str
    logo: Optional[str] = ""
    requires_login: bool = Field(default=False, alias="requiresLogin")
    username: Optional[str] = ""
    password: Optional[str] = ""
    is_active: bool = Field(default=True, alias="isActive")
    region: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), alias="createdAt")

    class Config:
        populate_by_name = True

