"""
Tenant resolution — FastAPI dependency that injects the current TenantDB
from the X-Tenant-Slug request header.
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import TenantDB


async def get_current_tenant(
    x_tenant_slug: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> TenantDB:
    """Resolves tenant from X-Tenant-Slug header. Required for all tenant-scoped routes."""
    if not x_tenant_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant não identificado. Acesse via subdomínio correto.",
        )

    result = await db.execute(
        select(TenantDB).where(TenantDB.slug == x_tenant_slug, TenantDB.is_active == True)
    )
    tenant = result.scalars().first()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{x_tenant_slug}' não encontrado ou inativo.",
        )

    return tenant


async def get_optional_tenant(
    x_tenant_slug: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Optional[TenantDB]:
    """Returns tenant or None — for super admin routes that may not need a tenant."""
    if not x_tenant_slug:
        return None
    result = await db.execute(
        select(TenantDB).where(TenantDB.slug == x_tenant_slug, TenantDB.is_active == True)
    )
    return result.scalars().first()
