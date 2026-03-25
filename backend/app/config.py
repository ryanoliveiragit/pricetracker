from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Configurações da aplicação"""

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # Scraping
    SCRAPING_TIMEOUT: int = 10
    MAX_CONCURRENT_SCRAPERS: int = 5

    # Segurança - Chave de criptografia
    CREDENTIALS_ENCRYPTION_KEY: Optional[str] = None

    # Credenciais de lojas - Formato antigo (manter compatibilidade)
    ESTOQUE_ATACADISTA_USERNAME: str = ""
    ESTOQUE_ATACADISTA_PASSWORD: str = ""

    # Credenciais de lojas - Novo formato
    SUPPLIER_ESTOQUE_MEGALESTE_USERNAME: Optional[str] = None
    SUPPLIER_ESTOQUE_MEGALESTE_PASSWORD: Optional[str] = None
    SUPPLIER_COFEMA_MATERIAIS_USERNAME: Optional[str] = None
    SUPPLIER_COFEMA_MATERIAIS_PASSWORD: Optional[str] = None
    SUPPLIER_ESTOQUE_ATACADISTA_USERNAME: Optional[str] = None
    SUPPLIER_ESTOQUE_ATACADISTA_PASSWORD: Optional[str] = None

    # Banco de dados
    DATABASE_URL: str = "postgresql+asyncpg://localhost/constructprice"

    # Cache / Redis
    REDIS_URL: str = "redis://localhost:6379"
    SEARCH_CACHE_TTL: int = 1800  # 30 minutos

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True
        # Permitir campos extras para suportar credenciais de novos fornecedores
        extra = "allow"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
