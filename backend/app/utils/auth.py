import hashlib
from typing import Optional
from fastapi import Depends, HTTPException, Header, status


# ─── simple in-memory "DB" for the mock auth ──────────────────────────────────
USERS_DB = {
    "admin@construprice.com": {
        "email": "admin@construprice.com",
        "password_hash": hashlib.sha256("admin".encode()).hexdigest(),
        "name": "Administrador",
        "role": "admin",
        "is_active": True,
    },
    "gestor@construprice.com": {
        "email": "gestor@construprice.com",
        "password_hash": hashlib.sha256("gestor123".encode()).hexdigest(),
        "name": "Gestor",
        "role": "gestor",
        "is_active": True,
    },
}


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_password_hash(password: str) -> str:
    return hash_password(password)


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


def authenticate_user(email: str, password: str) -> Optional[dict]:
    user = USERS_DB.get(email)
    if not user or not user["is_active"]:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return {"email": user["email"], "name": user["name"], "role": user.get("role", "usuario")}


# ─── Auth dependency ──────────────────────────────────────────────────────────

async def get_current_user_email(authorization: Optional[str] = Header(default=None)) -> str:
    """Extracts user email from Authorization header token."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token não fornecido")

    if authorization.startswith("Bearer "):
        token = authorization[7:]
    else:
        token = authorization

    if token.startswith("mock-token-"):
        email = token[len("mock-token-"):]
        return email

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
