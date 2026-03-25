from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid
import csv
import io
import logging

from app.models.catalog import CatalogProductCreate, CatalogProductUpdate
from app.models.db_models import ProductDB
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_camel_dict(p: ProductDB) -> dict:
    """Converte modelo DB para camelCase para compatibilidade com frontend."""
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "brand": p.brand,
        "unit": p.unit,
        "sku": p.sku or "",
        "logo": p.logo or "",
        "notes": p.notes or "",
        "createdAt": p.created_at.isoformat() if p.created_at else "",
    }


@router.get("/products")
async def list_products(db: AsyncSession = Depends(get_db)):
    """Listar todos os produtos do catálogo."""
    result = await db.execute(select(ProductDB).order_by(ProductDB.created_at.desc()))
    return [_to_camel_dict(p) for p in result.scalars().all()]


@router.get("/products/{product_id}")
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    """Buscar produto por ID."""
    p = await db.get(ProductDB, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return _to_camel_dict(p)


@router.post("/products", status_code=201)
async def create_product(data: CatalogProductCreate, db: AsyncSession = Depends(get_db)):
    """Criar novo produto."""
    product = ProductDB(
        id=str(uuid.uuid4()),
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
    logger.info(f"Produto criado: {product.name}")
    return _to_camel_dict(product)


@router.patch("/products/{product_id}")
async def update_product(product_id: str, data: CatalogProductUpdate, db: AsyncSession = Depends(get_db)):
    """Atualizar produto parcialmente."""
    p = await db.get(ProductDB, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(p, key, value)

    await db.commit()
    await db.refresh(p)
    logger.info(f"Produto atualizado: {p.name}")
    return _to_camel_dict(p)


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    """Remover produto."""
    p = await db.get(ProductDB, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    await db.delete(p)
    await db.commit()
    logger.info(f"Produto removido: {p.name}")


@router.post("/products/import-csv")
async def import_products_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """
    Importar produtos via CSV.
    Colunas esperadas: name, category, brand, unit (obrigatórias), sku, notes (opcionais).
    Aceita separadores , ou ;
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    # Remover diretiva "sep=;" do Excel se presente
    lines = text.split("\n")
    if lines and lines[0].strip().lower().startswith("sep="):
        text = "\n".join(lines[1:])

    # Detectar separador
    first_line = text.split("\n")[0]
    delimiter = ";" if ";" in first_line else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    # Normalizar nomes das colunas
    if reader.fieldnames:
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    required = {"name", "category", "brand", "unit"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        missing = required - set(reader.fieldnames or [])
        raise HTTPException(
            status_code=400,
            detail=f"Colunas obrigatórias faltando: {', '.join(missing)}. "
                   f"Colunas encontradas: {', '.join(reader.fieldnames or [])}"
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
    logger.info(f"CSV importado: {len(created)} produtos criados, {skipped} linhas ignoradas")
    return {
        "imported": len(created),
        "skipped": skipped,
        "products": created,
    }
