"""Reset super admin password. Run from backend/: python reset_superadmin.py"""
import asyncio
from sqlalchemy import select
from app.database import async_session, init_db
from app.models.db_models import UserDB, UserRole
from app.utils.auth import get_password_hash

EMAIL = "superadmin@construprice.com"
NEW_PASSWORD = "superadmin123"


async def main():
    await init_db()
    async with async_session() as session:
        result = await session.execute(
            select(UserDB).where(
                UserDB.email == EMAIL,
                UserDB.tenant_id == None,
            )
        )
        user = result.scalars().first()

        if user:
            user.password_hash = get_password_hash(NEW_PASSWORD)
            user.role = UserRole.SUPER_ADMIN
            user.is_active = True
            await session.commit()
            print(f"✅ Senha resetada para: {EMAIL} / {NEW_PASSWORD}")
        else:
            session.add(UserDB(
                nome="Super Admin",
                email=EMAIL,
                password_hash=get_password_hash(NEW_PASSWORD),
                role=UserRole.SUPER_ADMIN,
                tenant_id=None,
                is_active=True,
            ))
            await session.commit()
            print(f"✅ Super admin criado: {EMAIL} / {NEW_PASSWORD}")


asyncio.run(main())
