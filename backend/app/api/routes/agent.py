from typing import Any, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.routes.suppliers import get_all_suppliers_from_db
from app.services.search_agent import process_message

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AgentOption(BaseModel):
    label: str
    value: str


class SummaryField(BaseModel):
    field: str
    value: str


class SummaryProduct(BaseModel):
    product_key: str
    label: str
    ready: bool
    active: bool = False
    position: int = 0
    search_item: str
    selected_fields: List[SummaryField] = Field(default_factory=list)


class AgentSummary(BaseModel):
    supplier_label: str
    products: List[SummaryProduct] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    message: str
    ready: bool
    search_items: Optional[List[str]] = None
    thinking: Optional[str] = None
    suggested_aliases: List[str] = Field(default_factory=list)

    # Guided step metadata
    step: str
    product: Optional[str] = None
    active_product: Optional[str] = None
    progress_current: int = 0
    progress_total: int = 0
    input_type: str
    allow_free_text: bool = True
    options: List[AgentOption] = Field(default_factory=list)
    selected_suppliers: List[str] = Field(default_factory=list)
    summary: AgentSummary


@router.post("/agent/chat")
async def agent_chat(req: ChatRequest) -> ChatResponse:
    suppliers = await get_all_suppliers_from_db()
    supplier_names = [
        supplier.name for supplier in suppliers if getattr(supplier, "is_active", False)
    ]

    result: dict[str, Any] = process_message(
        req.message,
        [message.model_dump() for message in req.history],
        supplier_names=supplier_names,
    )

    return ChatResponse(**result)
