from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class User(BaseModel):
    """Modelo de usuário"""
    email: EmailStr
    password_hash: str
    name: str
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class LoginRequest(BaseModel):
    """Request de login"""
    email: EmailStr = Field(..., description="Email do usuário")
    password: str = Field(..., description="Senha do usuário")


class LoginResponse(BaseModel):
    """Response de login"""
    success: bool
    message: str
    user: Optional[dict] = None
    token: Optional[str] = None
