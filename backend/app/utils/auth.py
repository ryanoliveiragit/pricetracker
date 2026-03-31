import hashlib
from typing import Optional, List


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


# ─── RBAC helpers ─────────────────────────────────────────────────────────────

def _infer_role_from_email(email: str) -> str:
    email = email.lower()
    if "admin" in email:
        return "admin"
    if "gestor" in email:
        return "gestor"
    if "user" in email or "usuario" in email:
        return "usuario"
    return "funcionario"


async def get_current_active_user(token: str = ""):
    """
    Stub: in production replace with real JWT decode + DB lookup.
    For now we decode the mock token that the frontend already sends.
    """
    # The frontend sends token = "mock-token-<email>"
    # We extract the email portion and look up the role.
    if token.startswith("mock-token-"):
        email = token[len("mock-token-"):]
        user = USERS_DB.get(email)
        if user:
            from app.models.db_models import UserDB, UserRole
            stub = UserDB.__new__(UserDB)
            stub.id = 0
            stub.email = user["email"]
            stub.nome = user["name"]
            stub.role = UserRole(user.get("role", "admin"))
            stub.is_active = True
            stub.parent_id = None
            return stub
    # Fallback: admin stub so existing endpoints keep working
    from app.models.db_models import UserDB, UserRole
    stub = UserDB.__new__(UserDB)
    stub.id = 0
    stub.email = "admin@construprice.com"
    stub.nome = "Administrador"
    stub.role = UserRole.ADMIN
    stub.is_active = True
    stub.parent_id = None
    return stub


def require_roles(allowed_roles: list):
    """FastAPI dependency — checks that the user role is allowed."""
    async def dep(token: str = ""):
        user = await get_current_active_user(token)
        if user.role not in allowed_roles:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Acesso negado para este perfil.")
        return user
    return dep
