"""
Database module — async SQLAlchemy + PostgreSQL (asyncpg).

Provides:
    engine, async_session, Base, get_db()
"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger(__name__)

_connect_args = {"ssl": "require"} if "supabase.co" in settings.DATABASE_URL else {}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async session."""
    async with async_session() as session:
        yield session


async def create_tables():
    """Create all tables (called on startup)."""
    # Import models here to ensure they are registered with Base metadata
    from app.models import db_models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Tabelas do banco de dados criadas/verificadas")
