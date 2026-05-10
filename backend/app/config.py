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

    # IA / LLM
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    PERPLEXITY_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # Fluxo agente de feedback — criação de branch via GitHub API
    GITHUB_TOKEN: Optional[str] = None          # Personal access token (scope: repo)
    GITHUB_REPO: Optional[str] = None           # "owner/repo" ex: "ryanoliveiragit/pricetracker"
    GIT_BASE_BRANCH: str = "main"
    VERCEL_PREVIEW_PATTERN: Optional[str] = None  # ex: "https://pricetracker-git-{branch}.vercel.app"

    # JWT / Auth
    JWT_SECRET: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

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
