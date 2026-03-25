"""
Seed default data into PostgreSQL if tables are empty.
Runs once on startup — skips if data already exists.
"""
import logging
from sqlalchemy import select, func
from app.database import async_session
from app.models.db_models import ProductDB, SupplierDB

logger = logging.getLogger(__name__)

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
        "region": "sp",
        "notes": "Rede nacional de materiais de construção",
    },
    {
        "id": "3",
        "name": "Estoque Atacadista",
        "url": "https://hnk.estoqueatacadista.com.br",
        "requires_login": True,
        "username": "",
        "password": "",
        "is_active": False,
        "region": "sp",
        "notes": "Preencha usuário e senha para ativar",
    },
    {
        "id": "4",
        "name": "Constrular",
        "url": "https://constrular.com.br",
        "requires_login": False,
        "is_active": True,
        "region": "Sul",
        "notes": "Especializada em acabamentos",
    },
    {
        "id": "5",
        "name": "Leroy Merlin",
        "url": "https://leroymerlin.com.br",
        "requires_login": False,
        "is_active": True,
        "region": "Nacional",
        "notes": "Grande variedade de produtos",
    },
]


async def seed_defaults():
    """Insert default products and suppliers if tables are empty."""
    async with async_session() as session:
        # Products
        count = await session.scalar(select(func.count()).select_from(ProductDB))
        if count == 0:
            for p in DEFAULT_PRODUCTS:
                session.add(ProductDB(**p))
            await session.commit()
            logger.info(f"🌱 {len(DEFAULT_PRODUCTS)} produtos padrão inseridos")
        else:
            logger.info(f"📦 {count} produtos já existem no banco")

        # Suppliers
        count = await session.scalar(select(func.count()).select_from(SupplierDB))
        if count == 0:
            for s in DEFAULT_SUPPLIERS:
                session.add(SupplierDB(**s))
            await session.commit()
            logger.info(f"🌱 {len(DEFAULT_SUPPLIERS)} fornecedores padrão inseridos")
        else:
            logger.info(f"🏪 {count} fornecedores já existem no banco")
