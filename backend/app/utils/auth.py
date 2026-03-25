import hashlib
from typing import Optional


# Usuários em memória (em produção, usar banco de dados)
USERS_DB = {
    "admin@construprice.com": {
        "email": "admin@construprice.com",
        "password_hash": hashlib.sha256("admin".encode()).hexdigest(),
        "name": "Administrador",
        "is_active": True
    },
    "gestor@construprice.com": {
        "email": "gestor@construprice.com",
        "password_hash": hashlib.sha256("gestor123".encode()).hexdigest(),
        "name": "Gestor",
        "is_active": True
    }
}


def hash_password(password: str) -> str:
    """Gera hash SHA256 da senha"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha corresponde ao hash"""
    return hash_password(plain_password) == hashed_password


def authenticate_user(email: str, password: str) -> Optional[dict]:
    """
    Autentica usuário
    
    Returns:
        Dados do usuário se autenticado, None caso contrário
    """
    user = USERS_DB.get(email)
    
    if not user:
        return None
    
    if not user["is_active"]:
        return None
    
    if not verify_password(password, user["password_hash"]):
        return None
    
    # Retornar dados do usuário sem a senha
    return {
        "email": user["email"],
        "name": user["name"],
        "is_active": user["is_active"]
    }


def create_user(email: str, password: str, name: str) -> dict:
    """
    Cria novo usuário (para uso futuro)
    """
    if email in USERS_DB:
        raise ValueError("Usuário já existe")
    
    user = {
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "is_active": True
    }
    
    USERS_DB[email] = user
    
    return {
        "email": user["email"],
        "name": user["name"],
        "is_active": user["is_active"]
    }
