"""
Seed default data into PostgreSQL if tables are empty.
Also patches existing suppliers whose credentials are empty on every startup.
"""
import logging
from sqlalchemy import select, func
from app.database import async_session
from app.models.db_models import ProductDB, SupplierDB, UserDB, UserRole
from app.utils.auth import get_password_hash

logger = logging.getLogger(__name__)

DEFAULT_USERS = [
    {
        "nome": "Administrador",
        "email": "admin@construprice.com",
        "password_hash": get_password_hash("admin"),
        "role": UserRole.ADMIN,
        "is_active": True,
    },
    {
        "nome": "Gestor",
        "email": "gestor@construprice.com",
        "password_hash": get_password_hash("gestor123"),
        "role": UserRole.GESTOR,
        "is_active": True,
    },
]

# Map supplier name → index in DEFAULT_SUPPLIERS for fast lookup
_SUPPLIER_CREDS_BY_NAME: dict = {}  # populated after DEFAULT_SUPPLIERS is defined

DEFAULT_PRODUCTS = [
    {
        "id": "1",
        "name": "Cimento Portland CP-II 50kg",
        "category": "Cimento",
        "brand": "Votorantim",
        "unit": "Saco 50kg",
        "notes": "Cimento de uso geral",
    },
    {
        "id": "2",
        "name": "Tijolo Cerâmico 6 Furos",
        "category": "Alvenaria",
        "brand": "Cerâmica São Paulo",
        "unit": "Milheiro",
        "notes": "Tijolo padrão para construção",
    },
    {
        "id": "3",
        "name": "Areia Média Lavada",
        "category": "Agregados",
        "brand": "Areia Fina",
        "unit": "m³",
        "notes": "Para reboco e assentamento",
    },
    {
        "id": "4",
        "name": "Brita 1",
        "category": "Agregados",
        "brand": "Pedreira Central",
        "unit": "m³",
        "notes": "Para concreto estrutural",
    },
    {
        "id": "5",
        "name": "Vergalhão CA-50 10mm",
        "category": "Ferragens",
        "brand": "Gerdau",
        "unit": "Barra 12m",
        "notes": "Aço para estruturas",
    },
    {
        "id": "6",
        "name": "Tinta Acrílica Branca 18L",
        "category": "Tintas",
        "brand": "Suvinil",
        "unit": "Lata 18L",
        "notes": "Tinta para paredes internas e externas",
    },
    {
        "id": "7",
        "name": "Piso Cerâmico 45x45cm",
        "category": "Revestimentos",
        "brand": "Portobello",
        "unit": "m²",
        "notes": "Piso antiderrapante",
    },
    {
        "id": "8",
        "name": "Argamassa AC-II 20kg",
        "category": "Argamassas",
        "brand": "Quartzolit",
        "unit": "Saco 20kg",
        "notes": "Para assentamento de pisos",
    },
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
]


async def seed_defaults():
    """Insert default products, users and suppliers if tables are empty.
    Also patches credentials for existing suppliers that have empty username/password.
    """
    async with async_session() as session:
        # ── Users ─────────────────────────────────────────────────────────────
        count = await session.scalar(select(func.count()).select_from(UserDB))
        if count == 0:
            for u in DEFAULT_USERS:
                session.add(UserDB(**u))
            await session.commit()
            logger.info(f"🌱 {len(DEFAULT_USERS)} usuários padrão inseridos")
        else:
            logger.info(f"👥 {count} usuários já existem no banco")

        # ── Products ──────────────────────────────────────────────────────────
        count = await session.scalar(select(func.count()).select_from(ProductDB))
        if count == 0:
            for p in DEFAULT_PRODUCTS:
                session.add(ProductDB(**p))
            await session.commit()
            logger.info(f"🌱 {len(DEFAULT_PRODUCTS)} produtos padrão inseridos")
        else:
            logger.info(f"📦 {count} produtos já existem no banco")

        # ── Suppliers ─────────────────────────────────────────────────────────
        count = await session.scalar(select(func.count()).select_from(SupplierDB))
        if count == 0:
            for s in DEFAULT_SUPPLIERS:
                session.add(SupplierDB(**s))
            await session.commit()
            logger.info(f"🌱 {len(DEFAULT_SUPPLIERS)} fornecedores padrão inseridos")
        else:
            logger.info(f"🏪 {count} fornecedores no banco — sincronizando com DEFAULT_SUPPLIERS")

            default_names = {s["name"] for s in DEFAULT_SUPPLIERS}
            creds_map = {s["name"]: s for s in DEFAULT_SUPPLIERS}
            result = await session.execute(select(SupplierDB))
            all_suppliers = result.scalars().all()
            changed_count = 0

            for supplier in all_suppliers:
                # Remover fornecedores que não estão mais na lista padrão
                if supplier.name not in default_names:
                    logger.info(f"🗑️  Removendo fornecedor obsoleto: {supplier.name}")
                    await session.delete(supplier)
                    changed_count += 1
                    continue

                # Sincronizar campos com os valores padrão
                default = creds_map[supplier.name]
                changed = False
                for field, key in [("username", "username"), ("password", "password"), ("url", "url")]:
                    if default.get(key) and getattr(supplier, field) != default[key]:
                        setattr(supplier, field, default[key])
                        changed = True
                if default.get("is_active") is not None and supplier.is_active != default["is_active"]:
                    supplier.is_active = default["is_active"]
                    changed = True
                if changed:
                    changed_count += 1
                    logger.info(f"🔧 Fornecedor atualizado: {supplier.name}")

            # Inserir fornecedores que ainda não existem no banco
            existing_names = {s.name for s in all_suppliers}
            for default in DEFAULT_SUPPLIERS:
                if default["name"] not in existing_names:
                    session.add(SupplierDB(**default))
                    changed_count += 1
                    logger.info(f"➕ Novo fornecedor inserido: {default['name']}")

            if changed_count:
                await session.commit()
                logger.info(f"✅ Fornecedores sincronizados ({changed_count} alterações)")


async def force_reseed_suppliers():
    """Drop and recreate all suppliers with default data. Use via admin endpoint."""
    async with async_session() as session:
        result = await session.execute(select(SupplierDB))
        for s in result.scalars().all():
            await session.delete(s)
        await session.commit()

        for s in DEFAULT_SUPPLIERS:
            session.add(SupplierDB(**s))
        await session.commit()
        logger.info(f"🔄 Reseed forçado: {len(DEFAULT_SUPPLIERS)} fornecedores recriados")
    return len(DEFAULT_SUPPLIERS)
