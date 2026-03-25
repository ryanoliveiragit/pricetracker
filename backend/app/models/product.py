from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProductOffer(BaseModel):
    """Modelo para uma oferta de produto de uma loja"""
    store: str = Field(..., description="Nome da loja")
    product_name: str = Field(..., description="Nome do produto encontrado")
    price: float = Field(..., description="Preço do produto")
    currency: str = Field(default="BRL", description="Moeda")
    product_url: str = Field(..., description="URL do produto")
    add_to_cart_url: Optional[str] = Field(None, description="URL para adicionar ao carrinho")
    availability: str = Field(default="em_estoque", description="Disponibilidade: em_estoque, por_encomenda, indisponivel")
    score: float = Field(default=0.0, description="Score de similaridade com a busca")
    sku: Optional[str] = Field(None, description="Código/SKU do produto")
    image_url: Optional[str] = Field(None, description="URL da imagem do produto")
    description: Optional[str] = Field(None, description="Descrição adicional do produto")
    brand: Optional[str] = Field(None, description="Marca do produto")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class SearchItemResult(BaseModel):
    """Resultado de busca para um item específico"""
    raw_query: str = Field(..., description="Query original do usuário")
    normalized_query: str = Field(..., description="Query normalizada")
    offers: List[ProductOffer] = Field(default_factory=list, description="Lista de ofertas encontradas")
    search_duration_ms: Optional[int] = Field(None, description="Tempo de busca em ms")
    cached: bool = Field(default=False, description="Se o resultado veio do cache")


class StoreCredentials(BaseModel):
    """Credenciais de uma loja"""
    store_name: str = Field(..., description="Nome da loja")
    username: Optional[str] = Field(None, description="Usuário para login")
    password: Optional[str] = Field(None, description="Senha para login")
    is_active: bool = Field(default=True, description="Se a loja está ativa")


class SearchRequest(BaseModel):
    """Request de busca"""
    items: List[str] = Field(..., description="Lista de itens para buscar", min_items=1, max_items=20)
    stores: Optional[List[StoreCredentials]] = Field(None, description="Lista de lojas com credenciais (opcional)")
    force_refresh: bool = Field(default=False, description="Ignorar cache e forçar nova busca")


class SearchResponse(BaseModel):
    """Response da busca"""
    items: List[SearchItemResult] = Field(..., description="Resultados agrupados por item")
    total_items: int = Field(..., description="Total de itens buscados")
    stores: List[str] = Field(..., description="Lojas consultadas")
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    total_duration_ms: Optional[int] = Field(None, description="Tempo total da requisição em ms")
    estimated_wait_seconds: Optional[dict] = Field(None, description="Estimativa de tempo por scraper (histórico)")


class ProductSearchBySupplierRequest(BaseModel):
    """Request para buscar produtos por nome em fornecedor específico"""
    product_name: str = Field(..., description="Nome do produto a buscar", min_length=1)
    supplier_id: str = Field(..., description="ID do fornecedor no sistema")
    supplier_name: str = Field(..., description="Nome do fornecedor")
    username: Optional[str] = Field(None, description="Usuário para login (se necessário)")
    password: Optional[str] = Field(None, description="Senha para login (se necessário)")
    force_refresh: bool = Field(default=False, description="Ignorar cache e forçar nova busca")


class ProductSearchBySupplierResponse(BaseModel):
    """Response da busca por fornecedor"""
    product_name: str = Field(..., description="Nome do produto buscado")
    supplier_id: str = Field(..., description="ID do fornecedor")
    supplier_name: str = Field(..., description="Nome do fornecedor")
    total_results: int = Field(..., description="Total de produtos encontrados")
    results: List[ProductOffer] = Field(..., description="Lista de todos os produtos encontrados")
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    search_duration_ms: Optional[int] = Field(None, description="Tempo de busca em ms")
    cached: bool = Field(default=False, description="Se o resultado veio do cache")
    estimated_wait_seconds: Optional[float] = Field(None, description="Estimativa de tempo baseada no histórico")
