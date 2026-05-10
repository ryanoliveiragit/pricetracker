import csv
import io
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.catalog import CatalogProductCreate, CatalogProductUpdate
from app.models.db_models import ProductDB, TenantDB
from app.utils.tenant import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_camel_dict(p: ProductDB) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "brand": p.brand,
        "unit": p.unit,
        "sku": p.sku or "",
        "logo": p.logo or "",
        "notes": p.notes or "",
        "variants": p.variants or [],
        "createdAt": p.created_at.isoformat() if p.created_at else "",
    }


@router.get("/products")
async def list_products(
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductDB)
        .where(ProductDB.tenant_id == tenant.id)
        .order_by(ProductDB.created_at.desc())
    )
    return [_to_camel_dict(p) for p in result.scalars().all()]


@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductDB).where(ProductDB.id == product_id, ProductDB.tenant_id == tenant.id)
    )
    p = result.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return _to_camel_dict(p)


@router.post("/products", status_code=201)
async def create_product(
    data: CatalogProductCreate,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    product = ProductDB(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        name=data.name,
        category=data.category,
        brand=data.brand,
        unit=data.unit,
        sku=data.sku or "",
        logo=data.logo or "",
        notes=data.notes or "",
        created_at=datetime.now(timezone.utc),
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    logger.info("Produto criado: %s [tenant=%s]", product.name, tenant.slug)
    return _to_camel_dict(product)


@router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    data: CatalogProductUpdate,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductDB).where(ProductDB.id == product_id, ProductDB.tenant_id == tenant.id)
    )
    p = result.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(p, key, value)

    await db.commit()
    await db.refresh(p)
    return _to_camel_dict(p)


@router.patch("/products/{product_id}/variants")
async def update_variants(
    product_id: str,
    data: dict,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductDB).where(ProductDB.id == product_id, ProductDB.tenant_id == tenant.id)
    )
    p = result.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    variants = data.get("variants", [])
    if not isinstance(variants, list):
        raise HTTPException(status_code=400, detail="variants deve ser uma lista")
    p.variants = [str(v).strip() for v in variants if str(v).strip()]
    await db.commit()
    await db.refresh(p)
    return _to_camel_dict(p)


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: str,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductDB).where(ProductDB.id == product_id, ProductDB.tenant_id == tenant.id)
    )
    p = result.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    await db.delete(p)
    await db.commit()


@router.post("/products/import-csv")
async def import_products_csv(
    file: UploadFile = File(...),
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    lines = text.split("\n")
    if lines and lines[0].strip().lower().startswith("sep="):
        text = "\n".join(lines[1:])

    first_line = text.split("\n")[0]
    delimiter = ";" if ";" in first_line else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    if reader.fieldnames:
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    required = {"name", "category", "brand", "unit"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        missing = required - set(reader.fieldnames or [])
        raise HTTPException(
            status_code=400,
            detail=f"Colunas obrigatórias faltando: {', '.join(missing)}. "
                   f"Colunas encontradas: {', '.join(reader.fieldnames or [])}",
        )

    created = []
    skipped = 0
    for row in reader:
        name = (row.get("name") or "").strip()
        if not name:
            skipped += 1
            continue

        product = ProductDB(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            name=name,
            category=(row.get("category") or "").strip(),
            brand=(row.get("brand") or "").strip(),
            unit=(row.get("unit") or "").strip(),
            sku=(row.get("sku") or "").strip(),
            logo=(row.get("logo") or "").strip(),
            notes=(row.get("notes") or "").strip(),
            created_at=datetime.now(timezone.utc),
        )
        db.add(product)
        created.append(_to_camel_dict(product))

    await db.commit()
    logger.info("CSV importado: %d produtos [tenant=%s]", len(created), tenant.slug)
    return {"imported": len(created), "skipped": skipped, "products": created}


async def _ai_suggest(name: str) -> list[str]:
    import json
    import os
    import re

    import httpx

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY não configurada")

    prompt = (
        f"Você é um especialista em materiais de construção e ferragens brasileiro.\n"
        f"Produto: \"{name}\"\n\n"
        f"Liste outros NOMES pelos quais este produto é conhecido — sinônimos reais, não variações do mesmo nome.\n"
        f"Retorne APENAS um array JSON com strings em minúsculas, sem explicações, máximo 8 itens.\n"
        f'Exemplo: ["sinonimo1", "sinonimo2"]'
    )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()

    match = re.search(r'\[.*?\]', text, re.DOTALL)
    if not match:
        raise ValueError(f"AI não retornou JSON válido: {text[:200]}")
    suggestions = [s.strip().lower() for s in json.loads(match.group()) if s.strip()]
    return [s for s in suggestions if s != name.lower()][:8]


@router.post("/products/{product_id}/generate-variants")
async def generate_variants(
    product_id: str,
    tenant: TenantDB = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductDB).where(ProductDB.id == product_id, ProductDB.tenant_id == tenant.id)
    )
    p = result.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    try:
        return {"suggestions": await _ai_suggest(p.name)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI suggest error: %s", e)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar variantes: {str(e)}")


@router.post("/products/suggest-variants")
async def suggest_variants_by_name(data: dict):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name é obrigatório")
    try:
        return {"suggestions": await _ai_suggest(name)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI suggest error: %s", e)
        raise HTTPException(status_code=500, detail=f"Erro ao gerar variantes: {str(e)}")
