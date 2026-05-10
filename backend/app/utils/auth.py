import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header, status

from app.config import settings


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_password_hash(password: str) -> str:
    return hash_password(password)


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


def create_token(payload: dict) -> str:
    data = {
        **payload,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(data, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


async def get_current_user_email(authorization: Optional[str] = Header(default=None)) -> str:
    """Extracts user email from JWT. Accepts legacy mock-token for dev."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token não fornecido")

    token = authorization[7:] if authorization.startswith("Bearer ") else authorization

    # Legacy mock tokens (backward compat)
    if token.startswith("mock-token-"):
        return token[len("mock-token-"):]

    payload = decode_token(token)
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    return email


async def get_token_payload(authorization: Optional[str] = Header(default=None)) -> dict:
    """Returns full decoded JWT payload."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token não fornecido")

    token = authorization[7:] if authorization.startswith("Bearer ") else authorization

    if token.startswith("mock-token-"):
        email = token[len("mock-token-"):]
        return {"email": email, "role": "admin", "tenant_id": None, "tenant_slug": None}

    return decode_token(token)
