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
        "variants": p.variants or [],
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


@router.patch("/products/{product_id}/variants")
async def update_variants(product_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Atualizar lista de variantes do produto."""
    p = await db.get(ProductDB, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    variants = data.get("variants", [])
    if not isinstance(variants, list):
        raise HTTPException(status_code=400, detail="variants deve ser uma lista")
    p.variants = [str(v).strip() for v in variants if str(v).strip()]
    await db.commit()
    await db.refresh(p)
    return _to_camel_dict(p)


async def _ai_suggest(name: str) -> list[str]:
    """Chama Perplexity API para sugerir variantes de um produto."""
    import os, re, json
    import httpx

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY não configurada")

    prompt = (
        f"Você é um especialista em materiais de construção brasileiro.\n"
        f"Produto: \"{name}\"\n"
        f"Gere uma lista de sinônimos, nomes alternativos e variações como este produto pode ser chamado "
        f"em diferentes lojas ou regiões do Brasil (ex: nomes populares, abreviações, termos técnicos).\n"
        f"Retorne APENAS um array JSON com strings, sem explicações. Máximo 8 itens. Exemplo:\n"
        f'["nome alternativo 1", "nome alternativo 2"]'
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
async def generate_variants(product_id: str, db: AsyncSession = Depends(get_db)):
    """Gera variantes/sinônimos para o produto usando IA."""
    p = await db.get(ProductDB, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    try:
        return {"suggestions": await _ai_suggest(p.name)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI suggest error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar variantes: {str(e)}")


@router.post("/products/suggest-variants")
async def suggest_variants_by_name(data: dict):
    """Sugere variantes para um produto pelo nome (sem necessidade de ID)."""
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name é obrigatório")
    try:
        return {"suggestions": await _ai_suggest(name)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI suggest error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar variantes: {str(e)}")


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
