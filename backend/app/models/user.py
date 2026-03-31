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


# ── CRUD de Usuários/Funcionários ──────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Payload para criar um funcionário/usuário"""
    nome: str = Field(..., min_length=2)
    email: EmailStr
    telefone: Optional[str] = ""
    empresa: Optional[str] = ""
    cargo: Optional[str] = ""
    avatar: Optional[str] = ""
    password: str = Field(..., min_length=4)
    role: Optional[str] = "funcionario"
    parent_id: Optional[int] = None


class UserUpdate(BaseModel):
    """Payload para editar um usuário (todos opcionais)"""
    nome: Optional[str] = None
    telefone: Optional[str] = None
    empresa: Optional[str] = None
    cargo: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None   # se informado, troca a senha


class UserResponse(BaseModel):
    """Resposta de usuário sem dados sensíveis"""
    id: int
    nome: str
    email: str
    telefone: Optional[str] = ""
    empresa: Optional[str] = ""
    cargo: Optional[str] = ""
    avatar: Optional[str] = ""
    role: str
    is_active: bool
    parent_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
