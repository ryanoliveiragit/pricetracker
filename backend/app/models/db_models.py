"""
SQLAlchemy ORM models for PostgreSQL persistence.
"""
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, Float, DateTime, Integer, JSON, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


# ─── Tenant ───────────────────────────────────────────────────────────────────

class TenantDB(Base):
    """Tenant — cada cliente tem seu próprio tenant isolado."""
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(32), default="free")  # free | pro | enterprise
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False, server_default="{}")
    # settings keys: app_name, logo_url, primary_color, accent_color
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


# ─── Users ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"   # platform-level, tenant_id = NULL
    ADMIN = "admin"
    GESTOR = "gestor"
    USUARIO = "usuario"
    FUNCIONARIO = "funcionario"


class UserDB(Base):
    """Usuários e suas Roles no sistema RBAC."""
    __tablename__ = "users"
    __table_args__ = (
        # Email is unique per tenant (NULL tenant = super_admin, globally unique by convention)
        UniqueConstraint("email", "tenant_id", name="uq_users_email_tenant"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.id"), nullable=True, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    telefone: Mapped[str] = mapped_column(String(64), nullable=True, default="")
    empresa: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    cargo: Mapped[str] = mapped_column(String(128), nullable=True, default="")
    avatar: Mapped[str] = mapped_column(Text, nullable=True, default="")

    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x]),
        default=UserRole.USUARIO,
    )

    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


# ─── Suppliers ────────────────────────────────────────────────────────────────

class SupplierDB(Base):
    """Fornecedor — escopo por tenant."""
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(512), default="")
    logo: Mapped[str] = mapped_column(Text, default="")
    requires_login: Mapped[bool] = mapped_column(Boolean, default=False)
    username: Mapped[str] = mapped_column(String(128), default="")
    password: Mapped[str] = mapped_column(String(128), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    region: Mapped[str] = mapped_column(String(64), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


# ─── Products ─────────────────────────────────────────────────────────────────

class ProductDB(Base):
    """Produto do catálogo — escopo por tenant."""
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.id"), nullable=True, index=True)
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


# ─── Search Cache ─────────────────────────────────────────────────────────────

class SearchCacheDB(Base):
    """Cache de resultados de busca — escopo por tenant."""
    __tablename__ = "search_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.id"), nullable=True, index=True)
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


# ─── Saved Offers ─────────────────────────────────────────────────────────────

class SavedOfferDB(Base):
    """Ofertas salvas (favoritas) pelos usuários — escopo por tenant."""
    __tablename__ = "saved_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tenants.id"), nullable=True, index=True)
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


# ─── Scrape Timings ───────────────────────────────────────────────────────────

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


# ─── Scraped Products (catalog cache) ────────────────────────────────────────

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
    # Chave de deduplicação determinística: scraper_key|sku|<sku> quando há SKU,
    # senão scraper_key|name|<nome_normalizado>. Índice único criado em
    # create_tables() — permite upsert atômico (ON CONFLICT) sem deadlock.
    dedup_key: Mapped[str] = mapped_column(String(700), nullable=True)
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
    """Cookies de sessão persistidos por scraper."""
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


# ─── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackStatus(str, enum.Enum):
    pending = "pending"
    analyzed = "analyzed"
    approved = "approved"
    validated = "validated"
    executing = "executing"
    deployed = "deployed"
    merged = "merged"
    rejected = "rejected"


class FeedbackReportDB(Base):
    """Feedbacks de usuários sobre problemas de busca — analisados pela IA."""
    __tablename__ = "feedback_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(String(255), default="")

    problem_type: Mapped[str] = mapped_column(String(64), default="search")
    search_query: Mapped[str] = mapped_column(String(512), default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    screenshot_path: Mapped[str] = mapped_column(Text, nullable=True)
    reference_url: Mapped[str] = mapped_column(Text, nullable=True)

    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus, values_callable=lambda x: [item.value for item in x]),
        default=FeedbackStatus.pending, index=True
    )

    ai_summary: Mapped[str] = mapped_column(Text, nullable=True)
    ai_fix_type: Mapped[str] = mapped_column(String(64), nullable=True)
    ai_proposed_fix: Mapped[dict] = mapped_column(JSON, nullable=True)
    ai_confidence: Mapped[float] = mapped_column(Float, nullable=True)
    ai_explanation: Mapped[str] = mapped_column(Text, nullable=True)

    admin_email: Mapped[str] = mapped_column(String(255), nullable=True)
    admin_notes: Mapped[str] = mapped_column(Text, nullable=True)

    execution_status: Mapped[str] = mapped_column(String(32), nullable=True)
    execution_diff: Mapped[dict] = mapped_column(JSON, nullable=True)
    execution_summary: Mapped[str] = mapped_column(Text, nullable=True)
    execution_error: Mapped[str] = mapped_column(Text, nullable=True)

    validated_prompt: Mapped[str] = mapped_column(Text, nullable=True)
    branch_name: Mapped[str] = mapped_column(String(128), nullable=True)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=True)
    preview_url: Mapped[str] = mapped_column(Text, nullable=True)
    branch_url: Mapped[str] = mapped_column(Text, nullable=True)
    chat_history: Mapped[list] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class ScraperConfigDB(Base):
    """Configuração de scraper dinâmico criado via painel admin (sem código Python)."""
    __tablename__ = "scraper_configs"

    supplier_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("suppliers.id", ondelete="CASCADE"), primary_key=True
    )

    # Search
    search_url: Mapped[str] = mapped_column(Text, default="")
    base_url: Mapped[str] = mapped_column(String(512), default="")
    container_selector: Mapped[str] = mapped_column(Text, default="")
    name_selector: Mapped[str] = mapped_column(Text, default="")
    price_selector: Mapped[str] = mapped_column(Text, default="")
    link_selector: Mapped[str] = mapped_column(Text, default="a")
    image_selector: Mapped[str] = mapped_column(Text, default="")
    sku_selector: Mapped[str] = mapped_column(Text, default="")
    availability_selector: Mapped[str] = mapped_column(Text, default="")

    # Login (optional — only if supplier requires_login)
    login_url: Mapped[str] = mapped_column(Text, default="")
    login_username_field: Mapped[str] = mapped_column(String(128), default="email")
    login_password_field: Mapped[str] = mapped_column(String(128), default="password")
    login_csrf_selector: Mapped[str] = mapped_column(Text, default="")
    login_submit_url: Mapped[str] = mapped_column(Text, default="")
    login_success_check: Mapped[str] = mapped_column(String(32), default="url")
    login_success_value: Mapped[str] = mapped_column(Text, default="login")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class DynamicAbbreviationDB(Base):
    """Abreviações adicionadas dinamicamente via aprovação de feedback."""
    __tablename__ = "dynamic_abbreviations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    long_form: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    short_forms: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    feedback_id: Mapped[int] = mapped_column(Integer, ForeignKey("feedback_reports.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class DynamicSynonymDB(Base):
    """Grupos de sinônimos adicionados dinamicamente via aprovação de feedback."""
    __tablename__ = "dynamic_synonyms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    feedback_id: Mapped[int] = mapped_column(Integer, ForeignKey("feedback_reports.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
