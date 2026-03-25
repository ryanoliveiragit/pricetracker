from fastapi import APIRouter, HTTPException
import logging
from app.models.user import LoginRequest, LoginResponse
from app.utils.auth import authenticate_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Endpoint de login
    
    Credenciais padrão:
    - Email: admin@construprice.com | Senha: admin
    - Email: gestor@construprice.com | Senha: gestor123
    """
    try:
        user = authenticate_user(request.email, request.password)
        
        if not user:
            return LoginResponse(
                success=False,
                message="Email ou senha inválidos"
            )
        
        logger.info(f"Login bem-sucedido: {request.email}")
        
        return LoginResponse(
            success=True,
            message="Login realizado com sucesso",
            user=user,
            token=f"mock-token-{user['email']}"  # Em produção, usar JWT
        )
        
    except Exception as e:
        logger.error(f"Erro no login: {e}")
        raise HTTPException(status_code=500, detail="Erro ao processar login")


@router.get("/users")
async def list_users():
    """Lista usuários disponíveis (apenas para desenvolvimento)"""
    return {
        "users": [
            {
                "email": "admin@construprice.com",
                "password": "admin",
                "name": "Administrador"
            },
            {
                "email": "gestor@construprice.com",
                "password": "gestor123",
                "name": "Gestor"
            }
        ]
    }
