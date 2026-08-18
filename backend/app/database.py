"""
Database module — async SQLAlchemy + PostgreSQL (asyncpg).
"""
import logging
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger(__name__)

_connect_args = {"ssl": "require"} if "supabase." in settings.DATABASE_URL else {}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # Supabase session poolers commonly cap a project at 15 clients. Keep
    # the application well below that ceiling so health checks, migrations,
    # cookie persistence and concurrent requests can share the database.
    pool_size=int(os.getenv("DB_POOL_SIZE", "3")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "2")),
    pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "15")),
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
    """Create all tables and run incremental column migrations."""
    from app.models import db_models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Tabelas criadas/verificadas")

    sa = __import__("sqlalchemy")

    # ── Multi-tenancy column migrations ──────────────────────────────────────
    _tenant_columns = [
        # (table, column, definition)
        ("users",        "tenant_id",  "VARCHAR(64) REFERENCES tenants(id)"),
        ("suppliers",    "tenant_id",  "VARCHAR(64) REFERENCES tenants(id)"),
        ("products",     "tenant_id",  "VARCHAR(64) REFERENCES tenants(id)"),
        ("saved_offers", "tenant_id",  "VARCHAR(64) REFERENCES tenants(id)"),
        ("search_cache", "tenant_id",  "VARCHAR(64) REFERENCES tenants(id)"),
    ]
    for table, col, definition in _tenant_columns:
        try:
            async with engine.begin() as conn:
                await conn.execute(sa.text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {definition}"
                ))
        except Exception as e:
            logger.warning("Migração %s.%s: %s", table, col, e)

    # Drop old globally-unique email constraint on users and create composite one
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text(
                "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key"
            ))
            await conn.execute(sa.text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_tenant "
                "ON users (email, tenant_id)"
            ))
        logger.info("✅ Constraint email→(email, tenant_id) migrada")
    except Exception as e:
        logger.warning("Migração unique email: %s", e)

    # Add SUPER_ADMIN to userrole enum
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text(
                "ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'"
            ))
        logger.info("✅ Enum userrole: super_admin adicionado")
    except Exception as e:
        logger.debug("Enum userrole super_admin: %s", e)

    # ── Legacy migrations (suppliers, users, feedback) ───────────────────────
    _misc_migrations = [
        ("suppliers",        "created_by",       "INTEGER REFERENCES users(id)"),
        ("users",            "avatar",            "TEXT DEFAULT ''"),
        ("feedback_reports", "problem_type",      "VARCHAR(64) DEFAULT 'search'"),
        ("feedback_reports", "execution_status",  "VARCHAR(32)"),
        ("feedback_reports", "execution_diff",    "JSONB"),
        ("feedback_reports", "execution_summary", "TEXT"),
        ("feedback_reports", "execution_error",   "TEXT"),
        ("feedback_reports", "validated_prompt",  "TEXT"),
        ("feedback_reports", "branch_name",       "VARCHAR(128)"),
        ("feedback_reports", "commit_sha",        "VARCHAR(40)"),
        ("feedback_reports", "preview_url",       "TEXT"),
        ("feedback_reports", "branch_url",        "TEXT"),
    ]
    for table, col, definition in _misc_migrations:
        try:
            async with engine.begin() as conn:
                await conn.execute(sa.text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {definition}"
                ))
        except Exception as e:
            logger.warning("Migração %s.%s: %s", table, col, e)

    # Feedback status enum values
    for value in ["pending", "analyzed", "approved", "rejected", "validated",
                  "executing", "deployed", "merged"]:
        try:
            async with engine.begin() as conn:
                await conn.execute(sa.text(
                    f"ALTER TYPE feedbackstatus ADD VALUE IF NOT EXISTS '{value}'"
                ))
        except Exception as e:
            logger.debug("enum feedbackstatus '%s': %s", value, e)

    # Normalize uppercase legacy status labels
    try:
        async with engine.begin() as conn:
            for upper, lower in [("PENDING", "pending"), ("ANALYZED", "analyzed"),
                                  ("APPROVED", "approved"), ("REJECTED", "rejected")]:
                await conn.execute(sa.text(
                    f"UPDATE feedback_reports SET status = '{lower}'::feedbackstatus "
                    f"WHERE status::text = '{upper}'"
                ))
    except Exception as e:
        logger.warning("Normalização status: %s", e)

    # ── scraped_products: dedup_key + índice único (upsert atômico, anti-deadlock) ──
    try:
        async with engine.begin() as conn:
            # 1) Coluna de deduplicação
            await conn.execute(sa.text(
                "ALTER TABLE scraped_products "
                "ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(700)"
            ))
            # 2) Backfill com a MESMA regra usada em Python (store_scraped_results)
            await conn.execute(sa.text(
                "UPDATE scraped_products SET dedup_key = CASE "
                "  WHEN sku IS NOT NULL AND sku <> '' "
                "    THEN scraper_key || '|sku|' || sku "
                "  ELSE scraper_key || '|name|' || product_name_normalized "
                "END "
                "WHERE dedup_key IS NULL"
            ))
            # 3) Remove duplicatas existentes mantendo a linha mais recente (maior id)
            await conn.execute(sa.text(
                "DELETE FROM scraped_products a "
                "USING scraped_products b "
                "WHERE a.dedup_key = b.dedup_key AND a.id < b.id"
            ))
            # 4) Índice único — alvo do ON CONFLICT
            await conn.execute(sa.text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_scraped_dedup "
                "ON scraped_products (dedup_key)"
            ))
        logger.info("✅ scraped_products.dedup_key + índice único criados")
    except Exception as e:
        logger.warning("Migração scraped_products.dedup_key: %s", e)
