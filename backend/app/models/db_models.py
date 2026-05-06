"""
SQLAlchemy ORM models for PostgreSQL persistence.
"""
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, Float, DateTime, Integer, JSON, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProductDB(Base):
    """Produto do catálogo."""
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    brand: Mapped[str] = mapped_column(String(128), nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(128), default="")
    logo: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    variants: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class SupplierDB(Base):
    """Fornecedor."""
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(512), default="")
    logo: Mapped[str] = mapped_column(Text, default="")
    requires_login: Mapped[bool] = mapped_column(Boolean, default=False)
    username: Mapped[str] = mapped_column(String(128), default="")
    password: Mapped[str] = mapped_column(String(128), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    region: Mapped[str] = mapped_column(String(64), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class SearchCacheDB(Base):
    """
    Cache de resultados de busca.
    Chave composta: scraper_key + query.
    """
    __tablename__ = "search_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scraper_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    query: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    results: Mapped[dict] = mapped_column(JSON, nullable=False)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ScrapeTimingDB(Base):
    """Histórico de tempos de scraping por fornecedor."""
    __tablename__ = "scrape_timings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scraper_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    query: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    GESTOR = "gestor"
    USUARIO = "usuario"
    FUNCIONARIO = "funcionario"

class UserDB(Base):
    """Usuários e suas Roles no sistema RBAC."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    telefone: Mapped[str] = mapped_column(String(64), nullable=True, default="")
    empresa: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    cargo: Mapped[str] = mapped_column(String(128), nullable=True, default="")
    avatar: Mapped[str] = mapped_column(Text, nullable=True, default="")
    
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USUARIO)
    
    # Relacionamento de subordinação
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ScrapedProductDB(Base):
    """Produtos pré-scraped do catálogo local — busca instantânea."""
    __tablename__ = "scraped_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    product_name: Mapped[str] = mapped_column(String(512), nullable=False)
    product_name_normalized: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(16), default="BRL")
    product_url: Mapped[str] = mapped_column(Text, nullable=False)
    add_to_cart_url: Mapped[str] = mapped_column(Text, nullable=True)
    availability: Mapped[str] = mapped_column(String(64), default="em_estoque")
    sku: Mapped[str] = mapped_column(String(128), nullable=True, index=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    brand: Mapped[str] = mapped_column(String(128), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    source_query: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    scraper_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class CatalogScrapeStatusDB(Base):
    """Status da última execução do scraping do catálogo."""
    __tablename__ = "catalog_scrape_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scraper_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    total_products: Mapped[int] = mapped_column(Integer, default=0)
    total_queries: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    finished_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class ScraperSessionDB(Base):
    """
    Cookies de sessão persistidos por scraper.
    Permite reutilizar login entre restarts do app.
    """
    __tablename__ = "scraper_sessions"

    scraper_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    cookies_json: Mapped[str] = mapped_column(Text, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)


class SavedOfferDB(Base):
    """Ofertas salvas (favoritas) pelos usuários."""
    __tablename__ = "saved_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    
    store: Mapped[str] = mapped_column(String(255), nullable=False)
    product_name: Mapped[str] = mapped_column(String(512), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(16), default="BRL")
    product_url: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=True)
    availability: Mapped[str] = mapped_column(String(64), default="em_estoque")
    sku: Mapped[str] = mapped_column(String(128), nullable=True)
    brand: Mapped[str] = mapped_column(String(128), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

