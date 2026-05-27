import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres.nepwcsxyasvlftsjmzku:maeteamo123%40A_@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"

async def main():
    engine = create_async_engine(DATABASE_URL)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        r = await s.execute(text("SELECT id, slug, name FROM tenants WHERE slug ILIKE :q OR name ILIKE :q"), {"q": "%xzzzz%"})
        tenants = r.fetchall()
        print("TENANTS:", tenants)
        if tenants:
            tid = tenants[0][0]
            r2 = await s.execute(text("SELECT id, name, is_active, tenant_id FROM suppliers WHERE tenant_id = :tid"), {"tid": tid})
            rows = r2.fetchall()
            print(f"SUPPLIERS ({len(rows)}):")
            for row in rows:
                print(" ", row)
        else:
            print("Tenant nao encontrado. Listando todos os tenants:")
            r3 = await s.execute(text("SELECT id, slug, name FROM tenants LIMIT 20"))
            for row in r3.fetchall():
                print(" ", row)

asyncio.run(main())
