"""
Seed default data into PostgreSQL if tables are empty.
Creates a default tenant and assigns all default data to it.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.database import async_session
from app.models.db_models import ProductDB, SupplierDB, TenantDB, UserDB, UserRole
from app.utils.auth import get_password_hash

logger = logging.getLogger(__name__)

DEFAULT_TENANT = {
    "id": "default-tenant",
    "name": "Demo",
    "slug": "demo",
    "plan": "pro",
    "settings": {
        "app_name": "ConstruPrice",
        "logo_url": "",
        "primary_color": "#2563eb",
        "accent_color": "#7c3aed",
    },
    "is_active": True,
}

DEFAULT_SUPER_ADMIN = {
    "nome": "Super Admin",
    "email": "superadmin@construprice.com",
    "password": "superadmin123",
    "role": UserRole.SUPER_ADMIN,
    "tenant_id": None,
}

DEFAULT_USERS = [
    {
        "nome": "Administrador",
        "email": "admin@construprice.com",
        "password": "admin",
        "role": UserRole.ADMIN,
        "is_active": True,
    },
    {
        "nome": "Gestor",
        "email": "gestor@construprice.com",
        "password": "gestor123",
        "role": UserRole.GESTOR,
        "is_active": True,
    },
]

DEFAULT_PRODUCTS = [
    {"id": "1", "name": "Cimento Portland CP-II 50kg",  "category": "Cimento",       "brand": "Votorantim",         "unit": "Saco 50kg",  "notes": "Cimento de uso geral"},
    {"id": "2", "name": "Tijolo Cerâmico 6 Furos",      "category": "Alvenaria",     "brand": "Cerâmica São Paulo", "unit": "Milheiro",   "notes": "Tijolo padrão para construção"},
    {"id": "3", "name": "Areia Média Lavada",            "category": "Agregados",     "brand": "Areia Fina",         "unit": "m³",         "notes": "Para reboco e assentamento"},
    {"id": "4", "name": "Brita 1",                       "category": "Agregados",     "brand": "Pedreira Central",   "unit": "m³",         "notes": "Para concreto estrutural"},
    {"id": "5", "name": "Vergalhão CA-50 10mm",          "category": "Ferragens",     "brand": "Gerdau",             "unit": "Barra 12m",  "notes": "Aço para estruturas"},
    {"id": "6", "name": "Tinta Acrílica Branca 18L",     "category": "Tintas",        "brand": "Suvinil",            "unit": "Lata 18L",   "notes": "Tinta para paredes"},
    {"id": "7", "name": "Piso Cerâmico 45x45cm",         "category": "Revestimentos", "brand": "Portobello",         "unit": "m²",         "notes": "Piso antiderrapante"},
    {"id": "8", "name": "Argamassa AC-II 20kg",          "category": "Argamassas",    "brand": "Quartzolit",         "unit": "Saco 20kg",  "notes": "Para assentamento de pisos"},
]

DEFAULT_SUPPLIERS = [
    {
        "id": "1",
        "name": "Estoque Megaleste",
        "url": "https://www.megaleste.com.br",
        "requires_login": True,
        "username": "458953",
        "password": "0109",
        "is_active": True,
        "region": "Nordeste",
        "notes": "Principal fornecedor da região",
    },
    {
        "id": "2",
        "name": "Cofema Materiais",
        "url": "https://www.cofema.com.br",
        "requires_login": True,
        "username": "82858182",
        "password": "123456",
        "is_active": True,
        "region": "Nacional",
        "notes": "Rede nacional de materiais de construção",
    },
    {
        "id": "3",
        "name": "Estoque Atacadista",
        "url": "https://sjc.estoqueatacadista.com.br",
        "requires_login": True,
        "username": "bomretiro_materiais@hotmail.com",
        "password": "123456",
        "is_active": True,
        "region": "sp",
        "notes": "Atacado de materiais de construção",
    },
    {
        "id": "4",
        "name": "Super ABC Distribuidora",
        "url": "https://superabcdistribuidora.com.br",
        "requires_login": True,
        "username": "bomretiro_materiais@hotmail.com",
        "password": "Jjc253047",
        "is_active": True,
        "region": "sp",
        "notes": "Distribuidora de materiais de construção",
    },
    {
        "id": "5",
        "name": "Gigavale Atacado",
        "url": "https://www.gigavaleatacado.com.br",
        "requires_login": True,
        "username": "",
        "password": "",
        "is_active": True,
        "region": "sp",
        "notes": "Atacado B2B (login via Selenium/reCAPTCHA) — preencha as credenciais nas configurações do fornecedor",
    },
]


async def seed_defaults():
    """Seed default tenant, super admin, users, products and suppliers."""
    async with async_session() as session:

        # ── Default tenant ────────────────────────────────────────────────────
        tenant_count = await session.scalar(select(func.count()).select_from(TenantDB))
        if tenant_count == 0:
            tenant = TenantDB(
                **DEFAULT_TENANT,
                created_at=datetime.now(timezone.utc),
            )
            session.add(tenant)
            await session.commit()
            logger.info("🌱 Tenant padrão criado: %s", DEFAULT_TENANT["slug"])

        # Resolve default tenant ID
        result = await session.execute(
            select(TenantDB).where(TenantDB.slug == DEFAULT_TENANT["slug"])
        )
        default_tenant = result.scalars().first()
        if not default_tenant:
            logger.error("❌ Tenant padrão não encontrado após seed")
            return
        tenant_id = default_tenant.id

        # ── Super Admin (no tenant) — always upsert to keep credentials fixed ──
        sa_result = await session.execute(
            select(UserDB).where(
                UserDB.email == DEFAULT_SUPER_ADMIN["email"],
                UserDB.tenant_id == None,
            )
        )
        existing_sa = sa_result.scalars().first()
        if existing_sa:
            existing_sa.password_hash = get_password_hash(DEFAULT_SUPER_ADMIN["password"])
            existing_sa.role = DEFAULT_SUPER_ADMIN["role"]
            existing_sa.is_active = True
            await session.commit()
            logger.info("🔧 Super admin atualizado: %s", DEFAULT_SUPER_ADMIN["email"])
        else:
            session.add(UserDB(
                nome=DEFAULT_SUPER_ADMIN["nome"],
                email=DEFAULT_SUPER_ADMIN["email"],
                password_hash=get_password_hash(DEFAULT_SUPER_ADMIN["password"]),
                role=DEFAULT_SUPER_ADMIN["role"],
                tenant_id=None,
                is_active=True,
            ))
            await session.commit()
            logger.info("🌱 Super admin criado: %s", DEFAULT_SUPER_ADMIN["email"])

        # ── Tenant Users ──────────────────────────────────────────────────────
        user_count = await session.scalar(
            select(func.count()).select_from(UserDB).where(UserDB.tenant_id == tenant_id)
        )
        if user_count == 0:
            for u in DEFAULT_USERS:
                session.add(UserDB(
                    tenant_id=tenant_id,
                    nome=u["nome"],
                    email=u["email"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                    is_active=u["is_active"],
                ))
            await session.commit()
            logger.info("🌱 %d usuários padrão inseridos [tenant=%s]", len(DEFAULT_USERS), default_tenant.slug)

        # ── Products ──────────────────────────────────────────────────────────
        product_count = await session.scalar(
            select(func.count()).select_from(ProductDB).where(ProductDB.tenant_id == tenant_id)
        )
        if product_count == 0:
            for p in DEFAULT_PRODUCTS:
                session.add(ProductDB(tenant_id=tenant_id, **p))
            await session.commit()
            logger.info("🌱 %d produtos padrão inseridos [tenant=%s]", len(DEFAULT_PRODUCTS), default_tenant.slug)

        # ── Suppliers ─────────────────────────────────────────────────────────
        supplier_count = await session.scalar(
            select(func.count()).select_from(SupplierDB).where(SupplierDB.tenant_id == tenant_id)
        )
        if supplier_count == 0:
            for s in DEFAULT_SUPPLIERS:
                session.add(SupplierDB(tenant_id=tenant_id, **s))
            await session.commit()
            logger.info("🌱 %d fornecedores padrão inseridos [tenant=%s]", len(DEFAULT_SUPPLIERS), default_tenant.slug)
        else:
            # Sync credentials for existing suppliers of this tenant
            result = await session.execute(
                select(SupplierDB).where(SupplierDB.tenant_id == tenant_id)
            )
            all_suppliers = result.scalars().all()
            creds_map = {s["name"]: s for s in DEFAULT_SUPPLIERS}
            default_names = set(creds_map.keys())
            changed = 0

            for supplier in all_suppliers:
                if supplier.name not in default_names:
                    continue
                default = creds_map[supplier.name]
                for field, key in [("username", "username"), ("password", "password"), ("url", "url")]:
                    if default.get(key) and getattr(supplier, field) != default[key]:
                        setattr(supplier, field, default[key])
                        changed += 1

            for default in DEFAULT_SUPPLIERS:
                existing_names = {s.name for s in all_suppliers}
                if default["name"] not in existing_names:
                    session.add(SupplierDB(tenant_id=tenant_id, **default))
                    changed += 1

            if changed:
                await session.commit()
                logger.info("🔧 %d fornecedores sincronizados [tenant=%s]", changed, default_tenant.slug)


async def force_reseed_suppliers():
    """Drop and recreate default-tenant suppliers. Use via admin endpoint."""
    async with async_session() as session:
        result = await session.execute(
            select(TenantDB).where(TenantDB.slug == DEFAULT_TENANT["slug"])
        )
        default_tenant = result.scalars().first()
        if not default_tenant:
            return 0

        s_result = await session.execute(
            select(SupplierDB).where(SupplierDB.tenant_id == default_tenant.id)
        )
        for s in s_result.scalars().all():
            await session.delete(s)
        await session.commit()

        for s in DEFAULT_SUPPLIERS:
            session.add(SupplierDB(tenant_id=default_tenant.id, **s))
        await session.commit()
        logger.info("🔄 Reseed forçado: %d fornecedores recriados", len(DEFAULT_SUPPLIERS))
    return len(DEFAULT_SUPPLIERS)
