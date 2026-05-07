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

    # Add missing columns to existing tables if they don't exist
    try:
        async with engine.begin() as conn:
            await conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)"
                )
            )
        logger.info("✅ Coluna created_by adicionada a suppliers")
    except Exception as e:
        logger.warning(f"⚠️  Não foi possível adicionar created_by: {e}")

    try:
        async with engine.begin() as conn:
            await conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT ''"
                )
            )
        logger.info("✅ Coluna avatar adicionada a users")
    except Exception as e:
        logger.warning(f"⚠️  Não foi possível adicionar avatar: {e}")

    _migrations = [
        ("feedback_reports", "problem_type",       "VARCHAR(64) DEFAULT 'search'"),
        ("feedback_reports", "execution_status",   "VARCHAR(32)"),
        ("feedback_reports", "execution_diff",     "JSONB"),
        ("feedback_reports", "execution_summary",  "TEXT"),
        ("feedback_reports", "execution_error",    "TEXT"),
        # Fluxo agente (transcrever → validar → executar em branch → preview)
        ("feedback_reports", "validated_prompt",   "TEXT"),
        ("feedback_reports", "branch_name",        "VARCHAR(128)"),
        ("feedback_reports", "commit_sha",         "VARCHAR(40)"),
        ("feedback_reports", "preview_url",        "TEXT"),
        ("feedback_reports", "branch_url",         "TEXT"),
        ("dynamic_synonyms", "id",                 None),  # tabela nova — criada pelo create_all
    ]
    sa = __import__("sqlalchemy")
    for table, col, definition in _migrations:
        if definition is None:
            continue
        try:
            async with engine.begin() as conn:
                await conn.execute(sa.text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {definition}"
                ))
            logger.info(f"✅ Coluna {col} adicionada a {table}")
        except Exception as e:
            logger.warning(f"⚠️  Migração {table}.{col}: {e}")

    # Adicionar novos valores ao enum FeedbackStatus no Postgres
    # (ALTER TYPE ... ADD VALUE não suporta IF NOT EXISTS em todas as versões;
    # capturamos exceção quando o valor já existe)
    _new_status_values = ["validated", "executing", "deployed", "merged"]
    for value in _new_status_values:
        try:
            async with engine.begin() as conn:
                await conn.execute(sa.text(
                    f"ALTER TYPE feedbackstatus ADD VALUE IF NOT EXISTS '{value}'"
                ))
            logger.info(f"✅ Status '{value}' adicionado ao enum feedbackstatus")
        except Exception as e:
            logger.debug(f"enum feedbackstatus '{value}': {e}")
